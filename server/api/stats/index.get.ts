import { getDatabase, schema } from '~~/server/database'
import { sql } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const db = getDatabase()

  // Get counts per dataset
  const datasetCounts = await db
    .select({
      dataset: schema.logs.dataset,
      count: sql<number>`count(*)::int`
    })
    .from(schema.logs)
    .groupBy(schema.logs.dataset)

  // Get total count
  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.logs)

  // Get zone counts
  const zoneCounts = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.zones)

  // Get latest log timestamp per dataset
  const latestLogs = await db
    .select({
      dataset: schema.logs.dataset,
      latestTimestamp: sql<string>`max(timestamp)::text`
    })
    .from(schema.logs)
    .groupBy(schema.logs.dataset)

  return {
    totalLogs: totalResult[0]?.count || 0,
    totalZones: zoneCounts[0]?.count || 0,
    datasetCounts: Object.fromEntries(
      datasetCounts.map(d => [d.dataset, d.count])
    ),
    latestByDataset: Object.fromEntries(
      latestLogs.map(d => [d.dataset, d.latestTimestamp])
    )
  }
})
