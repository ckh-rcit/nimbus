import { getDatabase, schema } from '~~/server/database'
import { desc, eq, and, gte, lte, or, ilike, sql } from 'drizzle-orm'
import { ALL_DATASETS, type Dataset, type DatasetScope } from '~~/shared/types'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  
  // Parse query parameters
  const dataset = query.dataset as Dataset | undefined
  const scope = query.scope as DatasetScope | undefined
  const zoneId = query.zoneId as string | undefined
  const accountId = query.accountId as string | undefined
  const search = query.search as string | undefined
  const startTime = query.startTime as string | undefined
  const endTime = query.endTime as string | undefined
  const limit = Math.min(parseInt(query.limit as string) || 100, 1000)
  const offset = parseInt(query.offset as string) || 0

  // Validate dataset if provided
  if (dataset && !ALL_DATASETS.includes(dataset)) {
    throw createError({
      statusCode: 400,
      message: `Invalid dataset: ${dataset}`
    })
  }

  // Validate scope if provided
  if (scope && !['zone', 'account'].includes(scope)) {
    throw createError({
      statusCode: 400,
      message: `Invalid scope: ${scope}. Must be 'zone' or 'account'`
    })
  }

  const db = getDatabase()
  const conditions = []

  // Build where conditions
  if (dataset) {
    conditions.push(eq(schema.logs.dataset, dataset))
  }

  if (scope) {
    conditions.push(eq(schema.logs.scope, scope))
  }

  if (zoneId) {
    conditions.push(eq(schema.logs.zoneId, zoneId))
  }

  if (accountId) {
    conditions.push(eq(schema.logs.accountId, accountId))
  }

  if (startTime) {
    conditions.push(gte(schema.logs.timestamp, new Date(startTime)))
  }

  if (endTime) {
    conditions.push(lte(schema.logs.timestamp, new Date(endTime)))
  }

  // Search in rayId, clientIp, or JSONB data
  if (search) {
    conditions.push(
      or(
        ilike(schema.logs.rayId, `%${search}%`),
        ilike(schema.logs.clientIp, `%${search}%`),
        sql`${schema.logs.data}::text ILIKE ${'%' + search + '%'}`
      )
    )
  }

  // Execute query with zone name join
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [logs, countResult] = await Promise.all([
    db.select({
      id: schema.logs.id,
      dataset: schema.logs.dataset,
      scope: schema.logs.scope,
      zoneId: schema.logs.zoneId,
      zoneName: schema.zones.name,
      accountId: schema.logs.accountId,
      timestamp: schema.logs.timestamp,
      rayId: schema.logs.rayId,
      clientIp: schema.logs.clientIp,
      data: schema.logs.data,
      createdAt: schema.logs.createdAt
    })
      .from(schema.logs)
      .leftJoin(schema.zones, eq(schema.logs.zoneId, schema.zones.id))
      .where(whereClause)
      .orderBy(desc(schema.logs.timestamp))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` })
      .from(schema.logs)
      .where(whereClause)
  ])

  return {
    logs,
    pagination: {
      total: countResult[0]?.count || 0,
      limit,
      offset,
      hasMore: offset + logs.length < (countResult[0]?.count || 0)
    }
  }
})
