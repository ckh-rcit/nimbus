import { getDatabase, schema } from '~~/server/database'
import { sql, eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const zoneId = query.zoneId as string | undefined
  
  const db = getDatabase()

  // Build where clause for zone filtering
  const zoneCondition = zoneId ? eq(schema.logs.zoneId, zoneId) : undefined

  // Get counts per dataset (filtered by zone if selected)
  const datasetCounts = await db
    .select({
      dataset: schema.logs.dataset,
      count: sql<number>`count(*)::int`
    })
    .from(schema.logs)
    .where(zoneCondition)
    .groupBy(schema.logs.dataset)

  // Get total count (filtered by zone if selected)
  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.logs)
    .where(zoneCondition)

  // Get zone counts
  const zoneCounts = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.zones)

  // Get latest log timestamp per dataset (filtered by zone if selected)
  const latestLogs = await db
    .select({
      dataset: schema.logs.dataset,
      latestTimestamp: sql<string>`max(timestamp)::text`
    })
    .from(schema.logs)
    .where(zoneCondition)
    .groupBy(schema.logs.dataset)

  // Get logs from today (filtered by zone if selected)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  
  const todayCondition = sql`${schema.logs.timestamp} >= ${todayStart.toISOString()}`
  const logsTodayResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.logs)
    .where(zoneCondition ? and(zoneCondition, todayCondition) : todayCondition)

  return {
    totalLogs: totalResult[0]?.count || 0,
    totalZones: zoneCounts[0]?.count || 0,
    logsToday: logsTodayResult[0]?.count || 0,
    datasetCounts: Object.fromEntries(
      datasetCounts.map(d => [d.dataset, d.count])
    ),
    latestByDataset: Object.fromEntries(
      latestLogs.map(d => [d.dataset, d.latestTimestamp])
    ),
    filteredByZone: !!zoneId
  }
})
