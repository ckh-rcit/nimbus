/**
 * Add expression indexes for analytics queries (top-talkers).
 * 
 * These partial expression indexes dramatically speed up GROUP BY queries
 * on JSONB fields by avoiding full-table scans and JSONB extraction at query time.
 * 
 * Run with: npx tsx scripts/add-analytics-indexes.ts
 */
import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://nimbus:n3Z9xGdVRBsfXsfm9YUn@10.19.142.192:5432/nimbus'

async function main() {
  const sql = postgres(DATABASE_URL, { max: 1 })

  console.log('[INDEX] Connecting to database...')

  const indexes = [
    {
      name: 'logs_http_host_expr_idx',
      description: 'Expression index on ClientRequestHost for http_requests',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS logs_http_host_expr_idx
            ON logs ((data->>'ClientRequestHost'))
            WHERE dataset = 'http_requests' AND data->>'ClientRequestHost' IS NOT NULL`
    },
    {
      name: 'logs_http_status_expr_idx',
      description: 'Expression index on EdgeResponseStatus for http_requests',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS logs_http_status_expr_idx
            ON logs ((data->>'EdgeResponseStatus'))
            WHERE dataset = 'http_requests' AND data->>'EdgeResponseStatus' IS NOT NULL`
    },
    {
      name: 'logs_fw_action_expr_idx',
      description: 'Expression index on Action for firewall_events',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS logs_fw_action_expr_idx
            ON logs ((data->>'Action'))
            WHERE dataset = 'firewall_events' AND data->>'Action' IS NOT NULL`
    },
    {
      name: 'logs_ts_client_ip_idx',
      description: 'Composite index on (timestamp, client_ip) for top IPs query',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS logs_ts_client_ip_idx
            ON logs (timestamp, client_ip)
            WHERE client_ip IS NOT NULL`
    },
    {
      name: 'logs_zone_ts_client_ip_idx',
      description: 'Composite index on (zone_id, timestamp, client_ip) for zone-filtered top IPs',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS logs_zone_ts_client_ip_idx
            ON logs (zone_id, timestamp, client_ip)
            WHERE client_ip IS NOT NULL`
    }
  ]

  for (const idx of indexes) {
    console.log(`[INDEX] Creating: ${idx.name} — ${idx.description}`)
    try {
      await sql.unsafe(idx.sql)
      console.log(`[INDEX] ✓ ${idx.name} created successfully`)
    } catch (err: any) {
      console.error(`[INDEX] ✗ ${idx.name} failed: ${err.message}`)
    }
  }

  console.log('[INDEX] Done. Verifying indexes...')

  const existing = await sql`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'logs' AND indexname LIKE 'logs_%expr_%' OR indexname LIKE 'logs_ts_%' OR indexname LIKE 'logs_zone_ts_%'
    ORDER BY indexname
  `
  
  for (const row of existing) {
    console.log(`  ${row.indexname}`)
  }

  await sql.end()
  console.log('[INDEX] Connection closed.')
}

main().catch((err) => {
  console.error('[INDEX] Fatal error:', err)
  process.exit(1)
})
