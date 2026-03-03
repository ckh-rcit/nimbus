import { getDatabase, schema } from '~~/server/database'
import { sql } from 'drizzle-orm'
import { cachedQuery } from '~~/server/utils/cache'

// Cache TTL: 5 minutes — rollup data is already pre-aggregated, no need for frequent refreshes
const CACHE_TTL = 5 * 60 * 1000

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const zoneId = query.zoneId as string | undefined
  const hours = Math.min(parseInt(query.hours as string) || 24, 720)

  // Build a cache key that includes the filter parameters
  const cacheKey = `top-talkers:${zoneId || 'all'}:${hours}`

  return cachedQuery(cacheKey, CACHE_TTL, async () => {
    const db = getDatabase()

    const since = new Date(Date.now() - hours * 60 * 60 * 1000)
    const sinceISO = since.toISOString()

    // All queries now read from stats_rollup (small summary table) instead of scanning millions of raw logs.
    // Each query sums the pre-aggregated hourly counts.
    // zone_id uses '__all__' sentinel instead of NULL for proper unique index behavior.
    const zoneFilter = zoneId ? sql`AND zone_id = ${zoneId}` : sql``

    const [topHosts, topActions, topIps, mostTargeted] = await Promise.all([
      // Top 5 Hosts
      db.execute<{ value: string; count: number }>(sql`
        SELECT dimension_value AS value, sum(count)::int AS count
        FROM stats_rollup
        WHERE metric = 'host'
          AND hour_bucket >= ${sinceISO}::timestamptz
          ${zoneFilter}
        GROUP BY dimension_value
        ORDER BY count DESC
        LIMIT 5
      `).catch(() => []),

      // All Firewall Actions (for percentage breakdown)
      db.execute<{ value: string; count: number }>(sql`
        SELECT dimension_value AS value, sum(count)::int AS count
        FROM stats_rollup
        WHERE metric = 'fw_action'
          AND hour_bucket >= ${sinceISO}::timestamptz
          ${zoneFilter}
        GROUP BY dimension_value
        ORDER BY count DESC
      `).catch(() => []),

      // Top 5 Incoming IPs
      db.execute<{ value: string; count: number }>(sql`
        SELECT dimension_value AS value, sum(count)::int AS count
        FROM stats_rollup
        WHERE metric = 'client_ip'
          AND hour_bucket >= ${sinceISO}::timestamptz
          ${zoneFilter}
        GROUP BY dimension_value
        ORDER BY count DESC
        LIMIT 5
      `).catch(() => []),

      // Most Targeted Zones (only when viewing all zones)
      zoneId
        ? Promise.resolve([])
        : db.execute<{ zone_id: string; zone_name: string; count: number }>(sql`
            SELECT r.dimension_value AS zone_id, COALESCE(z.name, r.dimension_value) AS zone_name, sum(r.count)::int AS count
            FROM stats_rollup r
            LEFT JOIN zones z ON z.id = r.dimension_value
            WHERE r.metric = 'fw_mitigated_zone'
              AND r.hour_bucket >= ${sinceISO}::timestamptz
            GROUP BY r.dimension_value, z.name
            ORDER BY count DESC
            LIMIT 5
          `).catch(() => [])
    ])

    // Calculate firewall action percentages
    const actionsRaw = topActions as any[]
    const actionsTotal = actionsRaw.reduce((sum: number, r: any) => sum + Number(r.count), 0)
    const firewallActions = actionsRaw.map((r: any) => ({
      value: r.value || 'Unknown',
      count: Number(r.count),
      percent: actionsTotal > 0 ? Math.round((Number(r.count) / actionsTotal) * 1000) / 10 : 0
    }))

    return {
      period: `${hours}h`,
      cached: true,
      topHosts: (topHosts as any[]).map(r => ({ value: r.value || 'Unknown', count: Number(r.count) })),
      firewallActions,
      firewallTotal: actionsTotal,
      topIps: (topIps as any[]).map(r => ({ value: r.value || 'Unknown', count: Number(r.count) })),
      mostTargeted: (mostTargeted as any[]).map(r => ({
        zoneId: r.zone_id,
        zoneName: r.zone_name || 'Unknown',
        count: Number(r.count)
      }))
    }
  })
})
