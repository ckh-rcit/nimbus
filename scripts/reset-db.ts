import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://nimbus:n3Z9xGdVRBsfXsfm9YUn@10.19.142.192:5432/nimbus'

async function main() {
  const sql = postgres(DATABASE_URL, { max: 1 })

  // Cancel any active queries that might be holding locks (e.g. stuck CREATE INDEX CONCURRENTLY)
  console.log('[RESET] Cancelling any active long-running queries on logs...')
  await sql`
    SELECT pg_cancel_backend(pid) 
    FROM pg_stat_activity 
    WHERE state = 'active' 
      AND pid <> pg_backend_pid()
      AND query ILIKE '%logs%'
  `
  // Give it a moment
  await new Promise(r => setTimeout(r, 1000))

  // Terminate anything still stuck
  await sql`
    SELECT pg_terminate_backend(pid) 
    FROM pg_stat_activity 
    WHERE state = 'active' 
      AND pid <> pg_backend_pid()
      AND query ILIKE '%logs%'
  `
  await new Promise(r => setTimeout(r, 1000))

  // Drop any partial/invalid indexes from failed CONCURRENTLY builds
  console.log('[RESET] Dropping any invalid partial indexes...')
  const invalidIndexes = await sql`
    SELECT indexrelid::regclass AS name
    FROM pg_index WHERE NOT indisvalid
  `
  for (const idx of invalidIndexes) {
    console.log(`  Dropping invalid index: ${idx.name}`)
    await sql.unsafe(`DROP INDEX IF EXISTS ${idx.name}`)
  }

  // Truncate logs
  console.log('[RESET] Truncating logs table...')
  await sql.unsafe('TRUNCATE TABLE logs RESTART IDENTITY')
  console.log('[RESET] Logs table cleared.')

  // Create expression indexes (fast on empty table)
  const indexes = [
    `CREATE INDEX IF NOT EXISTS logs_http_host_expr_idx
     ON logs ((data->>'ClientRequestHost'))
     WHERE dataset = 'http_requests' AND data->>'ClientRequestHost' IS NOT NULL`,

    `CREATE INDEX IF NOT EXISTS logs_http_status_expr_idx
     ON logs ((data->>'EdgeResponseStatus'))
     WHERE dataset = 'http_requests' AND data->>'EdgeResponseStatus' IS NOT NULL`,

    `CREATE INDEX IF NOT EXISTS logs_fw_action_expr_idx
     ON logs ((data->>'Action'))
     WHERE dataset = 'firewall_events' AND data->>'Action' IS NOT NULL`,

    `CREATE INDEX IF NOT EXISTS logs_ts_client_ip_idx
     ON logs (timestamp, client_ip)
     WHERE client_ip IS NOT NULL`,

    `CREATE INDEX IF NOT EXISTS logs_zone_ts_client_ip_idx
     ON logs (zone_id, timestamp, client_ip)
     WHERE client_ip IS NOT NULL`
  ]

  for (const ddl of indexes) {
    const name = ddl.match(/IF NOT EXISTS (\S+)/)?.[1] || 'unknown'
    console.log(`[INDEX] Creating ${name}...`)
    await sql.unsafe(ddl)
    console.log(`[INDEX] ✓ ${name}`)
  }

  // Verify
  const existing = await sql`
    SELECT indexname FROM pg_indexes WHERE tablename = 'logs' ORDER BY indexname
  `
  console.log(`\n[DONE] ${existing.length} indexes on logs table:`)
  for (const row of existing) {
    console.log(`  ${row.indexname}`)
  }

  await sql.end()
}

main().catch(err => { console.error(err); process.exit(1) })
