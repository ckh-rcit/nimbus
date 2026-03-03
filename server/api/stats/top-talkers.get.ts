import { getDatabase, schema } from '~~/server/database'
import { sql } from 'drizzle-orm'
import { cachedQuery } from '~~/server/utils/cache'

// Cache TTL: 60 seconds — analytics data doesn't need to be real-time
const CACHE_TTL = 60_000

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

    // Use raw SQL to leverage the expression indexes we created
    const zoneFilter = zoneId ? sql`AND zone_id = ${zoneId}` : sql``

    // Run all four queries in parallel
    const [topHosts, topActions, topIps, mostTargeted] = await Promise.all([
      // Top 5 Hosts — uses logs_http_host_expr_idx
      db.execute<{ value: string; count: number }>(sql`
        SELECT data->>'ClientRequestHost' AS value, count(*)::int AS count
        FROM logs
        WHERE dataset = 'http_requests'
          AND timestamp >= ${sinceISO}::timestamptz
          ${zoneFilter}
          AND data->>'ClientRequestHost' IS NOT NULL
        GROUP BY data->>'ClientRequestHost'
        ORDER BY count DESC
        LIMIT 5
      `).catch(() => []),

      // All Firewall Actions (for percentage breakdown) — uses logs_fw_action_expr_idx
      db.execute<{ value: string; count: number }>(sql`
        SELECT data->>'Action' AS value, count(*)::int AS count
        FROM logs
        WHERE dataset = 'firewall_events'
          AND timestamp >= ${sinceISO}::timestamptz
          ${zoneFilter}
          AND data->>'Action' IS NOT NULL
        GROUP BY data->>'Action'
        ORDER BY count DESC
      `).catch(() => []),

      // Top 5 Incoming IPs — uses logs_ts_client_ip_idx / logs_zone_ts_client_ip_idx
      db.execute<{ value: string; count: number }>(sql`
        SELECT client_ip AS value, count(*)::int AS count
        FROM logs
        WHERE timestamp >= ${sinceISO}::timestamptz
          ${zoneFilter}
          AND client_ip IS NOT NULL
        GROUP BY client_ip
        ORDER BY count DESC
        LIMIT 5
      `).catch(() => []),

      // Most Targeted Zones — zones with the most mitigated (non-allow) firewall events
      // Only relevant when viewing all zones (no zone filter)
      zoneId
        ? Promise.resolve([])
        : db.execute<{ zone_id: string; zone_name: string; count: number }>(sql`
            SELECT l.zone_id, COALESCE(z.name, l.zone_id) AS zone_name, count(*)::int AS count
            FROM logs l
            LEFT JOIN zones z ON z.id = l.zone_id
            WHERE l.dataset = 'firewall_events'
              AND l.timestamp >= ${sinceISO}::timestamptz
              AND l.zone_id IS NOT NULL
              AND l.data->>'Action' IS NOT NULL
              AND l.data->>'Action' NOT IN ('allow', 'skip')
            GROUP BY l.zone_id, z.name
            ORDER BY count DESC
            LIMIT 5
          `).catch(() => [])
    ])

    // Calculate firewall action percentages
    const actionsRaw = topActions as any[]
    const actionsTotal = actionsRaw.reduce((sum, r) => sum + Number(r.count), 0)
    const firewallActions = actionsRaw.map(r => ({
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
