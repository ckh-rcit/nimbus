import { getDatabase, schema } from '~~/server/database'
import { sql, and, gte } from 'drizzle-orm'

/**
 * Executive Report API
 * 
 * Generates comprehensive statistics for management reporting:
 * - Traffic overview
 * - Security metrics (blocked threats, attack types)
 * - Geographic distribution
 * - Top zones and hosts
 * - Performance indicators
 * 
 * NOTE: Uses full aggregations (not sampling) for accuracy.
 * Queries are optimized with indexes on timestamp, dataset, and zone_id.
 * Database statement timeout should be configured to prevent long-running queries.
 */

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const hours = Math.min(parseInt(query.hours as string) || 24, 720) // Max 30 days
  const zoneId = query.zoneId as string | undefined

  const db = getDatabase()
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)
  const sinceISO = since.toISOString()

  // Build zone filter for raw logs
  const zoneCondition = zoneId ? and(
    gte(schema.logs.timestamp, since),
    sql`${schema.logs.zoneId} = ${zoneId}`
  ) : gte(schema.logs.timestamp, since)

  // Build zone filter for rollups
  const zoneRollupFilter = zoneId ? sql`AND zone_id = ${zoneId}` : sql``

  try {
    // Run all queries in parallel - ALL from rollup for maximum speed
    const [
      trafficCounts,
      firewallStats,
      topCountries,
      topZones,
      topHosts,
      topThreats,
      statusCodes,
      cacheStats
    ] = await Promise.all([
      // Total traffic by dataset (from rollup - pre-aggregated)
      db.execute<{ dataset: string; count: number }>(sql`
        SELECT 
          dimension_value AS dataset,
          SUM(count)::int AS count
        FROM stats_rollup
        WHERE metric = 'dataset'
          AND hour_bucket >= ${sinceISO}::timestamptz
          ${zoneRollupFilter}
        GROUP BY dimension_value
      `).catch(() => []),

      // Firewall statistics from rollup (pre-aggregated)
      db.execute<{ action: string; count: number }>(sql`
        SELECT dimension_value AS action, sum(count)::int AS count
        FROM stats_rollup
        WHERE metric = 'fw_action'
          AND hour_bucket >= ${sinceISO}::timestamptz
          ${zoneRollupFilter}
        GROUP BY dimension_value
        ORDER BY count DESC
      `).catch(() => []),

      // Top countries (from rollup - pre-aggregated)
      db.execute<{ country: string; count: number }>(sql`
        SELECT 
          dimension_value AS country,
          SUM(count)::int AS count
        FROM stats_rollup
        WHERE metric = 'country'
          AND hour_bucket >= ${sinceISO}::timestamptz
          ${zoneRollupFilter}
        GROUP BY dimension_value
        ORDER BY count DESC
        LIMIT 10
      `).catch(() => []),

      // Top zones from rollup (pre-aggregated)
      zoneId ? Promise.resolve([]) : db.execute<{ zone_id: string; zone_name: string; count: number }>(sql`
        SELECT 
          r.zone_id AS zone_id,
          COALESCE(z.name, r.zone_id) AS zone_name,
          sum(r.count)::int AS count
        FROM stats_rollup r
        LEFT JOIN zones z ON z.id = r.zone_id
        WHERE r.metric IN ('host', 'fw_action')
          AND r.hour_bucket >= ${sinceISO}::timestamptz
          AND r.zone_id != '__all__'
          AND r.zone_id IS NOT NULL
          AND r.zone_id NOT IN ('skip', 'unknown', '', 'null')
        GROUP BY r.zone_id, z.name
        ORDER BY count DESC
        LIMIT 10
      `).catch(() => []),

      // Top hosts from rollup (pre-aggregated)
      db.execute<{ host: string; count: number }>(sql`
        SELECT dimension_value AS host, sum(count)::int AS count
        FROM stats_rollup
        WHERE metric = 'host'
          AND hour_bucket >= ${sinceISO}::timestamptz
          ${zoneRollupFilter}
        GROUP BY dimension_value
        ORDER BY count DESC
        LIMIT 10
      `).catch(() => []),

      // Top threat sources (still needs raw logs for IP details - but counts are fast)
      db.execute<{ ip: string; country: string; asn: string; count: number }>(sql`
        WITH blocked_counts AS (
          SELECT 
            client_ip,
            count(*)::int AS block_count
          FROM logs
          WHERE timestamp >= ${sinceISO}::timestamptz
            ${zoneId ? sql`AND zone_id = ${zoneId}` : sql``}
            AND dataset = 'firewall_events'
            AND client_ip IS NOT NULL
            AND (
              (data->>'Action')::text IN ('block', 'managed_challenge')
              OR (data->>'Action')::text LIKE '%block%'
            )
          GROUP BY client_ip
          ORDER BY block_count DESC
          LIMIT 10
        ),
        ip_details AS (
          SELECT DISTINCT ON (client_ip)
            client_ip,
            data->>'ClientCountry' AS country,
            data->>'ClientASN' AS asn
          FROM logs
          WHERE client_ip IN (SELECT client_ip FROM blocked_counts)
            AND dataset = 'firewall_events'
          ORDER BY client_ip, timestamp DESC
        )
        SELECT 
          bc.client_ip AS ip,
          COALESCE(d.country, 'Unknown') AS country,
          COALESCE('AS' || d.asn, 'Unknown') AS asn,
          bc.block_count AS count
        FROM blocked_counts bc
        LEFT JOIN ip_details d ON d.client_ip = bc.client_ip
        ORDER BY bc.block_count DESC
      `).catch(() => []),

      // HTTP status code distribution (from rollup - pre-aggregated)
      db.execute<{ status: string; count: number }>(sql`
        SELECT 
          dimension_value AS status,
          SUM(count)::int AS count
        FROM stats_rollup
        WHERE metric = 'http_status'
          AND hour_bucket >= ${sinceISO}::timestamptz
          ${zoneRollupFilter}
        GROUP BY dimension_value
        ORDER BY count DESC
        LIMIT 15
      `).catch(() => []),

      // Cache statistics (from rollup - pre-aggregated)
      db.execute<{ status: string; count: number }>(sql`
        SELECT 
          dimension_value AS status,
          SUM(count)::int AS count
        FROM stats_rollup
        WHERE metric = 'cache_status'
          AND hour_bucket >= ${sinceISO}::timestamptz
          ${zoneRollupFilter}
        GROUP BY dimension_value
        ORDER BY count DESC
      `).catch(() => [])
    ])

    // Process firewall stats
    const fwStatsRaw = firewallStats as any[]
    const totalFirewallEvents = fwStatsRaw.reduce((sum, r) => sum + Number(r.count), 0)
    const blockedRequests = fwStatsRaw
      .filter(r => r.action && (r.action === 'block' || r.action.includes('block')))
      .reduce((sum, r) => sum + Number(r.count), 0)
    const challengedRequests = fwStatsRaw
      .filter(r => r.action && (r.action.includes('challenge') || r.action === 'challenge'))
      .reduce((sum, r) => sum + Number(r.count), 0)

    // Process traffic counts
    const trafficByDataset = Object.fromEntries(
      (trafficCounts as any[]).map(r => [r.dataset, Number(r.count)])
    )
    const totalRequests = (trafficCounts as any[]).reduce((sum, r) => sum + Number(r.count), 0)

    // Process cache stats
    const cacheStatsRaw = cacheStats as any[]
    const cacheHits = cacheStatsRaw
      .filter(r => r.status && (r.status === 'hit' || r.status === 'revalidated'))
      .reduce((sum, r) => sum + Number(r.count), 0)
    const totalCacheableRequests = cacheStatsRaw.reduce((sum, r) => sum + Number(r.count), 0)
    const cacheHitRate = totalCacheableRequests > 0 
      ? Math.round((cacheHits / totalCacheableRequests) * 100) 
      : 0

    // Process status codes (accurate counts, not sampled)
    const statusCodesRaw = statusCodes as any[]
    const totalHttpRequests = statusCodesRaw.reduce((sum, r) => sum + Number(r.count), 0)
    const successfulRequests = statusCodesRaw
      .filter(r => r.status && r.status.startsWith('2'))
      .reduce((sum, r) => sum + Number(r.count), 0)
    const clientErrors = statusCodesRaw
      .filter(r => r.status && r.status.startsWith('4'))
      .reduce((sum, r) => sum + Number(r.count), 0)
    const serverErrors = statusCodesRaw
      .filter(r => r.status && r.status.startsWith('5'))
      .reduce((sum, r) => sum + Number(r.count), 0)
    const otherStatuses = statusCodesRaw
      .filter(r => r.status && !r.status.startsWith('2') && !r.status.startsWith('4') && !r.status.startsWith('5'))
      .reduce((sum, r) => sum + Number(r.count), 0)

    return {
      generatedAt: new Date().toISOString(),
      period: {
        hours,
        start: sinceISO,
        end: new Date().toISOString()
      },
      zoneId: zoneId || null,
      
      // Overview metrics
      overview: {
        totalRequests,
        httpRequests: trafficByDataset.http_requests || 0,
        firewallEvents: trafficByDataset.firewall_events || 0,
        blockedRequests,
        challengedRequests,
        allowedRequests: totalFirewallEvents - blockedRequests - challengedRequests,
        blockRate: totalFirewallEvents > 0 
          ? Math.round((blockedRequests / totalFirewallEvents) * 100) 
          : 0
      },

      // Performance metrics
      performance: {
        cacheHitRate,
        successRate: totalHttpRequests > 0 
          ? Math.round((successfulRequests / totalHttpRequests) * 100) 
          : 0,
        clientErrorRate: totalHttpRequests > 0 
          ? Math.round((clientErrors / totalHttpRequests) * 100) 
          : 0,
        serverErrorRate: totalHttpRequests > 0 
          ? Math.round((serverErrors / totalHttpRequests) * 100) 
          : 0
      },

      // Top lists
      topCountries: (topCountries as any[]).map(r => ({
        country: r.country || 'Unknown',
        count: Number(r.count)
      })),

      topZones: (topZones as any[]).map(r => ({
        zoneId: r.zone_id,
        zoneName: r.zone_name,
        count: Number(r.count)
      })),

      topHosts: (topHosts as any[]).map(r => ({
        host: r.host || 'Unknown',
        count: Number(r.count)
      })),

      topThreats: (topThreats as any[]).map(r => ({
        ip: r.ip,
        country: r.country || 'Unknown',
        asn: r.asn || 'Unknown',
        count: Number(r.count)
      })),

      // Detailed breakdowns
      firewallActions: fwStatsRaw.map(r => ({
        action: r.action || 'Unknown',
        count: Number(r.count),
        percent: totalFirewallEvents > 0 
          ? Math.round((Number(r.count) / totalFirewallEvents) * 100) 
          : 0
      })),

      statusCodes: statusCodesRaw.map(r => ({
        status: r.status || 'Unknown',
        count: Number(r.count)
      })),

      cacheStatus: cacheStatsRaw.map(r => ({
        status: r.status || 'Unknown',
        count: Number(r.count)
      }))
    }
  } catch (error) {
    console.error('Report generation error:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to generate report'
    })
  }
})
