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
    const [topIps, topHosts, topStatuses, topActions] = await Promise.all([
      // Top 5 Client IPs — uses logs_ts_client_ip_idx / logs_zone_ts_client_ip_idx
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

      // Top 5 HTTP Status Codes — uses logs_http_status_expr_idx
      db.execute<{ value: string; count: number }>(sql`
        SELECT data->>'EdgeResponseStatus' AS value, count(*)::int AS count
        FROM logs
        WHERE dataset = 'http_requests'
          AND timestamp >= ${sinceISO}::timestamptz
          ${zoneFilter}
          AND data->>'EdgeResponseStatus' IS NOT NULL
        GROUP BY data->>'EdgeResponseStatus'
        ORDER BY count DESC
        LIMIT 5
      `).catch(() => []),

      // Top 5 Firewall Actions — uses logs_fw_action_expr_idx
      db.execute<{ value: string; count: number }>(sql`
        SELECT data->>'Action' AS value, count(*)::int AS count
        FROM logs
        WHERE dataset = 'firewall_events'
          AND timestamp >= ${sinceISO}::timestamptz
          ${zoneFilter}
          AND data->>'Action' IS NOT NULL
        GROUP BY data->>'Action'
        ORDER BY count DESC
        LIMIT 5
      `).catch(() => [])
    ])

    return {
      period: `${hours}h`,
      cached: true,
      topIps: (topIps as any[]).map(r => ({ value: r.value || 'Unknown', count: Number(r.count) })),
      topHosts: (topHosts as any[]).map(r => ({ value: r.value || 'Unknown', count: Number(r.count) })),
      topStatuses: (topStatuses as any[]).map(r => ({ value: r.value || 'Unknown', count: Number(r.count) })),
      topActions: (topActions as any[]).map(r => ({ value: r.value || 'Unknown', count: Number(r.count) }))
    }
  })
})
