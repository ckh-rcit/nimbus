import { gunzipSync } from 'node:zlib'
import { getDatabase, schema } from '~~/server/database'
import { ALL_DATASETS, getDatasetScope, type Dataset } from '~~/shared/types'

/**
 * Unified Logpush Ingestion Endpoint
 * 
 * Cloudflare Logpush HTTP destination URL format:
 * https://nimbus.rivcoit.com/api/ingest?dataset=http_requests&header_Authorization=Bearer%20YOUR_TOKEN
 * 
 * Query parameters:
 * - dataset (required): The Cloudflare dataset name (e.g., http_requests, firewall_events, audit_logs)
 * - header_Authorization: Auth token in format "Bearer YOUR_TOKEN" (URL encoded)
 * - Any additional parameters passed by Cloudflare (tags, etc.)
 */

// Field mappings for extracting common fields from different datasets
const TIMESTAMP_FIELDS: Record<string, string> = {
  http_requests: 'EdgeStartTimestamp',
  firewall_events: 'Datetime',
  dns_logs: 'Timestamp',
  audit_logs: 'When',
  audit_logs_v2: 'When',
  gateway_dns: 'Datetime',
  gateway_http: 'Datetime',
  gateway_network: 'Datetime',
  access_requests: 'CreatedAt',
  workers_trace_events: 'EventTimestampMs',
  spectrum_events: 'Timestamp',
  nel_reports: 'Timestamp',
  page_shield_events: 'Timestamp',
  zaraz_events: 'Timestamp',
  zero_trust_network_sessions: 'SessionStartTime',
  biso_user_actions: 'Timestamp',
  casb_findings: 'DetectedTimestamp',
  device_posture_results: 'Timestamp',
  dex_application_tests: 'Timestamp',
  dex_device_state_events: 'Timestamp',
  dlp_forensic_copies: 'Timestamp',
  dns_firewall_logs: 'Timestamp',
  email_security_alerts: 'Timestamp',
  ipsec_logs: 'Timestamp',
  magic_ids_detections: 'Timestamp',
  network_analytics_logs: 'Timestamp',
  sinkhole_http_logs: 'Timestamp',
  ssh_logs: 'Timestamp',
  warp_config_changes: 'Timestamp',
  warp_toggle_changes: 'Timestamp'
}

const RAY_ID_FIELDS: Record<string, string> = {
  http_requests: 'RayID',
  firewall_events: 'RayID',
  dns_logs: 'RayID'
}

const CLIENT_IP_FIELDS: Record<string, string> = {
  http_requests: 'ClientIP',
  firewall_events: 'ClientIP',
  dns_logs: 'SourceIP',
  gateway_dns: 'SourceIP',
  gateway_http: 'SourceIP',
  access_requests: 'IPAddress'
}

const ZONE_ID_FIELDS: Record<string, string> = {
  http_requests: 'ZoneID',
  firewall_events: 'ZoneID',
  dns_logs: 'ZoneID'
}

function parseTimestamp(value: unknown): Date {
  if (!value) return new Date()
  
  // Handle RFC3339 strings
  if (typeof value === 'string') {
    return new Date(value)
  }
  
  // Handle Unix timestamps (seconds)
  if (typeof value === 'number') {
    // If it looks like nanoseconds (very large number), convert
    if (value > 1e15) {
      return new Date(value / 1e6)
    }
    // If it looks like milliseconds
    if (value > 1e12) {
      return new Date(value)
    }
    // Unix seconds
    return new Date(value * 1000)
  }
  
  return new Date()
}

function extractField(data: Record<string, unknown>, fieldMap: Record<string, string>, dataset: string): string | null {
  const field = fieldMap[dataset]
  if (!field) return null
  return (data[field] as string) || null
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  
  // Get dataset from query parameter
  const dataset = query.dataset as Dataset
  
  if (!dataset) {
    throw createError({
      statusCode: 400,
      message: 'Missing required query parameter: dataset. Example: ?dataset=http_requests'
    })
  }

  // Validate dataset
  if (!ALL_DATASETS.includes(dataset)) {
    throw createError({
      statusCode: 400,
      message: `Invalid dataset: ${dataset}. Valid datasets: ${ALL_DATASETS.join(', ')}`
    })
  }

  // Extract auth token from query params
  // Cloudflare sends as ?header_Authorization=Bearer%20TOKEN (URL encoded)
  const authHeader = query['header_Authorization'] as string || ''
  const token = authHeader.replace('Bearer ', '').trim()
  
  const config = useRuntimeConfig()
  
  // Validate auth token
  if (!token || token !== config.ingestAuthToken) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized: Invalid or missing authentication token'
    })
  }

  // Read the raw body
  const rawBody = await readRawBody(event, false)
  
  if (!rawBody) {
    throw createError({
      statusCode: 400,
      message: 'Empty request body'
    })
  }

  let bodyText: string

  // Decompress if gzipped
  const contentEncoding = getHeader(event, 'content-encoding')
  if (contentEncoding === 'gzip' || rawBody[0] === 0x1f) {
    try {
      const buffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody)
      const decompressed = gunzipSync(buffer)
      bodyText = decompressed.toString('utf-8')
    } catch (error) {
      throw createError({
        statusCode: 400,
        message: `Failed to decompress gzip body: ${error}`
      })
    }
  } else {
    bodyText = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8')
  }

  // Parse NDJSON (newline-delimited JSON)
  const lines = bodyText.trim().split('\n').filter(line => line.trim())
  
  if (lines.length === 0) {
    return { success: true, message: 'No log entries to process', count: 0 }
  }

  const db = getDatabase()
  const logsToInsert: Array<typeof schema.logs.$inferInsert> = []
  const scope = getDatasetScope(dataset)
  const accountId = config.cloudflareAccountId

  for (const line of lines) {
    try {
      const data = JSON.parse(line) as Record<string, unknown>
      
      // Extract common fields
      const timestampField = TIMESTAMP_FIELDS[dataset] || 'Timestamp'
      const timestamp = parseTimestamp(data[timestampField])
      const rayId = extractField(data, RAY_ID_FIELDS, dataset)
      const clientIp = extractField(data, CLIENT_IP_FIELDS, dataset)
      const zoneId = scope === 'zone' ? extractField(data, ZONE_ID_FIELDS, dataset) : null

      logsToInsert.push({
        dataset,
        scope,
        zoneId,
        accountId,
        timestamp,
        rayId,
        clientIp,
        data
      })
    } catch (parseError) {
      console.warn(`[Ingest] Failed to parse log line: ${parseError}`)
      // Continue processing other lines
    }
  }

  // Batch insert logs
  if (logsToInsert.length > 0) {
    try {
      // Insert in batches of 1000 to avoid memory issues
      const batchSize = 1000
      for (let i = 0; i < logsToInsert.length; i += batchSize) {
        const batch = logsToInsert.slice(i, i + batchSize)
        await db.insert(schema.logs).values(batch)
      }
      
      console.log(`[Ingest] Inserted ${logsToInsert.length} ${dataset} logs (scope: ${scope})`)
    } catch (dbError) {
      console.error(`[Ingest] Database error:`, dbError)
      throw createError({
        statusCode: 500,
        message: `Failed to insert logs: ${dbError}`
      })
    }
  }

  return {
    success: true,
    message: `Processed ${logsToInsert.length} log entries`,
    count: logsToInsert.length,
    dataset,
    scope
  }
})
