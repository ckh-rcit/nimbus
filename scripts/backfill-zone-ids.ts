/**
 * Backfill zoneId from log data for existing logs
 * Run with: bun run scripts/backfill-zone-ids.ts
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { isNull, eq } from 'drizzle-orm'
import * as schema from '../server/database/schema'

// Map of host field by dataset
const HOST_FIELDS: Record<string, string> = {
  http_requests: 'ClientRequestHost',
  firewall_events: 'ClientRequestHost',
  dns_logs: 'QueryName',
  nel_reports: 'URL',
}

async function backfillZoneIds() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable not set')
  }
  
  const client = postgres(databaseUrl)
  const db = drizzle(client, { schema })
  
  // Get all zones to create a lookup map
  const zones = await db.select().from(schema.zones)
  console.log(`Loaded ${zones.length} zones for lookup`)
  
  // Create a map of zone name -> zone id
  const zoneMap = new Map<string, string>()
  for (const zone of zones) {
    zoneMap.set(zone.name.toLowerCase(), zone.id)
  }
  
  // Get all logs where zoneId is null and scope is 'zone'
  const logsWithoutZone = await db
    .select({
      id: schema.logs.id,
      dataset: schema.logs.dataset,
      data: schema.logs.data
    })
    .from(schema.logs)
    .where(isNull(schema.logs.zoneId))
    .limit(10000)

  console.log(`Found ${logsWithoutZone.length} logs without zoneId`)

  // Debug: show sample data fields
  if (logsWithoutZone.length > 0) {
    const sample = logsWithoutZone[0]
    const data = sample.data as Record<string, unknown>
    console.log(`\nSample log (${sample.dataset}):`)
    const hostField = HOST_FIELDS[sample.dataset]
    if (hostField) {
      console.log(`Host field (${hostField}): ${data[hostField]}`)
    }
  }

  let updated = 0
  let skipped = 0

  for (const log of logsWithoutZone) {
    const data = log.data as Record<string, unknown>
    const hostField = HOST_FIELDS[log.dataset]
    
    if (hostField && data[hostField]) {
      let host = (data[hostField] as string).toLowerCase()
      
      // Extract domain from URL if needed
      if (host.startsWith('http')) {
        try {
          host = new URL(host).hostname
        } catch {}
      }
      
      // Try to find matching zone
      let zoneId: string | undefined
      
      // First try exact match
      if (zoneMap.has(host)) {
        zoneId = zoneMap.get(host)
      } else {
        // Try to match parent domain (e.g., www.example.com -> example.com)
        const parts = host.split('.')
        for (let i = 0; i < parts.length - 1; i++) {
          const parentDomain = parts.slice(i).join('.')
          if (zoneMap.has(parentDomain)) {
            zoneId = zoneMap.get(parentDomain)
            break
          }
        }
      }
      
      if (zoneId) {
        await db
          .update(schema.logs)
          .set({ zoneId })
          .where(eq(schema.logs.id, log.id))
        updated++
      } else {
        skipped++
      }
    } else {
      skipped++
    }
  }

  console.log(`Updated ${updated} logs, skipped ${skipped}`)
  
  await client.end()
}

backfillZoneIds()
  .then(() => {
    console.log('Done!')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
