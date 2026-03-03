import { sql } from 'drizzle-orm'
import { getDatabase, schema } from '~~/server/database'

/**
 * Metric types tracked in the rollup table.
 * Each maps to a dimension extracted from log data at ingest time.
 */
type RollupEntry = {
  hourBucket: Date
  metric: string
  dimensionValue: string
  zoneId: string // Use '__all__' sentinel for cross-zone (NULL zone) to avoid PG NULL uniqueness issues
}

/** Sentinel value for zone_id when the log has no zone. Avoids NULL in unique index. */
const ALL_ZONES_SENTINEL = '__all__'

/**
 * Truncate a Date to the start of its hour (UTC).
 */
function truncateToHour(date: Date): Date {
  const d = new Date(date)
  d.setUTCMinutes(0, 0, 0)
  return d
}

/**
 * Extract rollup dimensions from a batch of parsed log entries.
 * Called during ingest to build the list of counters to upsert.
 */
export function extractRollupEntries(
  logs: Array<{
    dataset: string
    zoneId?: string | null | undefined
    timestamp: Date
    clientIp?: string | null | undefined
    data: unknown
  }>
): RollupEntry[] {
  const entries: RollupEntry[] = []

  for (const log of logs) {
    const hourBucket = truncateToHour(log.timestamp)
    const data = log.data as Record<string, unknown>
    const zoneId = log.zoneId || ALL_ZONES_SENTINEL

    // --- host (from http_requests) ---
    if (log.dataset === 'http_requests') {
      const host = data['ClientRequestHost'] as string | undefined
      if (host) {
        entries.push({ hourBucket, metric: 'host', dimensionValue: host, zoneId })
      }
    }

    // --- client_ip (all datasets) ---
    if (log.clientIp) {
      entries.push({ hourBucket, metric: 'client_ip', dimensionValue: log.clientIp, zoneId })
    }

    // --- fw_action (from firewall_events) ---
    if (log.dataset === 'firewall_events') {
      const action = data['Action'] as string | undefined
      if (action) {
        entries.push({ hourBucket, metric: 'fw_action', dimensionValue: action, zoneId })

        // --- fw_mitigated_zone: count non-allow/skip actions per zone ---
        const lower = action.toLowerCase()
        if (lower !== 'allow' && lower !== 'skip' && log.zoneId) {
          entries.push({ hourBucket, metric: 'fw_mitigated_zone', dimensionValue: log.zoneId, zoneId })
        }
      }
    }
  }

  return entries
}

/**
 * Upsert rollup entries into stats_rollup using a single
 * INSERT ... ON CONFLICT DO UPDATE SET count = count + excluded.count.
 * 
 * Entries are first aggregated in-memory to minimize DB round-trips
 * (one row per unique key instead of one per log line).
 */
export async function updateRollups(
  entries: RollupEntry[]
): Promise<void> {
  if (entries.length === 0) return

  // Aggregate in-memory: key → total count
  const agg = new Map<string, { entry: RollupEntry; count: number }>()
  for (const e of entries) {
    const key = `${e.hourBucket.toISOString()}|${e.metric}|${e.dimensionValue}|${e.zoneId ?? ''}`
    const existing = agg.get(key)
    if (existing) {
      existing.count++
    } else {
      agg.set(key, { entry: e, count: 1 })
    }
  }

  const db = getDatabase()
  const rows = Array.from(agg.values())

  // Batch upsert in chunks of 500 to stay within PG parameter limits
  const batchSize = 500
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const values = batch.map(r =>
      sql`(${r.entry.hourBucket.toISOString()}::timestamptz, ${r.entry.metric}, ${r.entry.dimensionValue}, ${r.entry.zoneId}, ${r.count})`
    )

    await db.execute(sql`
      INSERT INTO stats_rollup (hour_bucket, metric, dimension_value, zone_id, count)
      VALUES ${sql.join(values, sql`, `)}
      ON CONFLICT (hour_bucket, metric, dimension_value, zone_id)
      DO UPDATE SET count = stats_rollup.count + EXCLUDED.count
    `)
  }
}
