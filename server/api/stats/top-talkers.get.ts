import { getDatabase, schema } from '~~/server/database'
import { sql, eq, and, gte } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const zoneId = query.zoneId as string | undefined
  const hours = Math.min(parseInt(query.hours as string) || 24, 720)

  const db = getDatabase()

  const since = new Date(Date.now() - hours * 60 * 60 * 1000)
  const timeCondition = gte(schema.logs.timestamp, since)
  const zoneCondition = zoneId ? eq(schema.logs.zoneId, zoneId) : undefined
  const baseCondition = zoneCondition ? and(zoneCondition, timeCondition) : timeCondition

  // Run all four queries in parallel
  const [topIps, topHosts, topStatuses, topActions] = await Promise.all([
    // Top 5 Client IPs
    db.select({
      value: schema.logs.clientIp,
      count: sql<number>`count(*)::int`
    })
    .from(schema.logs)
    .where(and(baseCondition, sql`${schema.logs.clientIp} IS NOT NULL`))
    .groupBy(schema.logs.clientIp)
    .orderBy(sql`count(*) DESC`)
    .limit(5),

    // Top 5 Hosts (from HTTP requests data->>'ClientRequestHost')
    db.select({
      value: sql<string>`${schema.logs.data}->>'ClientRequestHost'`,
      count: sql<number>`count(*)::int`
    })
    .from(schema.logs)
    .where(and(baseCondition, eq(schema.logs.dataset, 'http_requests'), sql`${schema.logs.data}->>'ClientRequestHost' IS NOT NULL`))
    .groupBy(sql`${schema.logs.data}->>'ClientRequestHost'`)
    .orderBy(sql`count(*) DESC`)
    .limit(5),

    // Top 5 HTTP Status Codes
    db.select({
      value: sql<string>`${schema.logs.data}->>'EdgeResponseStatus'`,
      count: sql<number>`count(*)::int`
    })
    .from(schema.logs)
    .where(and(baseCondition, eq(schema.logs.dataset, 'http_requests'), sql`${schema.logs.data}->>'EdgeResponseStatus' IS NOT NULL`))
    .groupBy(sql`${schema.logs.data}->>'EdgeResponseStatus'`)
    .orderBy(sql`count(*) DESC`)
    .limit(5),

    // Top 5 Firewall Actions
    db.select({
      value: sql<string>`${schema.logs.data}->>'Action'`,
      count: sql<number>`count(*)::int`
    })
    .from(schema.logs)
    .where(and(baseCondition, eq(schema.logs.dataset, 'firewall_events'), sql`${schema.logs.data}->>'Action' IS NOT NULL`))
    .groupBy(sql`${schema.logs.data}->>'Action'`)
    .orderBy(sql`count(*) DESC`)
    .limit(5)
  ])

  return {
    period: `${hours}h`,
    topIps: topIps.map(r => ({ value: r.value || 'Unknown', count: r.count })),
    topHosts: topHosts.map(r => ({ value: r.value || 'Unknown', count: r.count })),
    topStatuses: topStatuses.map(r => ({ value: r.value || 'Unknown', count: r.count })),
    topActions: topActions.map(r => ({ value: r.value || 'Unknown', count: r.count }))
  }
})
