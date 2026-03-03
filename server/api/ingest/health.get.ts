import { desc } from 'drizzle-orm'
import { getDatabase, schema } from '~~/server/database'

/**
 * Ingest Health Check Endpoint
 * 
 * Returns the status of the ingestion pipeline by checking:
 * - The timestamp of the most recently ingested log
 * - Whether data is being actively received
 * 
 * Useful for Cloudflare Zero Trust policy verification
 */

export default defineEventHandler(async () => {
  const db = getDatabase()

  try {
    // Get the most recent log entry
    const recentLogs = await db
      .select({
        createdAt: schema.logs.createdAt,
        dataset: schema.logs.dataset,
        zoneId: schema.logs.zoneId
      })
      .from(schema.logs)
      .orderBy(desc(schema.logs.createdAt))
      .limit(1)

    if (recentLogs.length === 0) {
      return {
        healthy: false,
        status: 'no_data',
        message: 'No logs have been ingested yet',
        lastIngest: null,
        minutesSinceLastIngest: null
      }
    }

    const lastLog = recentLogs[0]!
    const lastIngestTime = new Date(lastLog.createdAt)
    const now = new Date()
    const minutesSinceLastIngest = Math.floor((now.getTime() - lastIngestTime.getTime()) / 1000 / 60)

    // Consider healthy if data received in last 10 minutes
    // This threshold can be adjusted based on your log volume
    const healthyThresholdMinutes = 10
    const healthy = minutesSinceLastIngest <= healthyThresholdMinutes

    let status: 'healthy' | 'degraded' | 'unhealthy'
    let message: string

    if (minutesSinceLastIngest <= 5) {
      status = 'healthy'
      message = 'Ingestion is active'
    } else if (minutesSinceLastIngest <= healthyThresholdMinutes) {
      status = 'degraded'
      message = 'Ingestion may be delayed'
    } else {
      status = 'unhealthy'
      message = 'No recent data received'
    }

    return {
      healthy,
      status,
      message,
      lastIngest: lastIngestTime.toISOString(),
      minutesSinceLastIngest,
      lastDataset: lastLog.dataset,
      lastZoneId: lastLog.zoneId
    }
  } catch (error) {
    console.error('Health check error:', error)
    return {
      healthy: false,
      status: 'error',
      message: 'Error checking ingest health',
      lastIngest: null,
      minutesSinceLastIngest: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})
