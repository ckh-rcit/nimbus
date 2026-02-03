import { gunzipSync } from 'node:zlib'
import { getDatabase, schema } from '~~/server/database'
import { getDatasetScope, type Dataset } from '~~/shared/types'

/**
 * Universal Logpush Ingestion Endpoint
 * 
 * Cloudflare Logpush HTTP destination URL format:
 * https://nimbus.rivcoit.com/api/ingest?header_Authorization=Bearer%20YOUR_TOKEN
 * 
 * The dataset is auto-detected from the log data fields.
 * Authentication via header_Authorization query parameter.
 */

// Dataset detection based on unique field combinations
// Each dataset has signature fields that identify it
const DATASET_SIGNATURES: Array<{ dataset: Dataset; requiredFields: string[]; optionalFields?: string[] }> = [
  // Zone-scoped datasets
  { dataset: 'http_requests', requiredFields: ['EdgeStartTimestamp', 'ClientRequestHost', 'EdgeResponseStatus'] },
  { dataset: 'firewall_events', requiredFields: ['Action', 'ClientRequestHost', 'Source'], optionalFields: ['RuleID'] },
  { dataset: 'dns_logs', requiredFields: ['QueryName', 'QueryType', 'ResponseCode'] },
  { dataset: 'spectrum_events', requiredFields: ['Application', 'Event', 'OriginIP'] },
  { dataset: 'nel_reports', requiredFields: ['Type', 'URL', 'Body'] },
  { dataset: 'page_shield_events', requiredFields: ['ScriptURL', 'PageURL'] },
  { dataset: 'zaraz_events', requiredFields: ['EventType', 'Tool'] },
  
  // Account-scoped datasets
  { dataset: 'audit_logs', requiredFields: ['ActionType', 'ActorEmail', 'When'], optionalFields: ['ResourceType'] },
  { dataset: 'audit_logs_v2', requiredFields: ['ActionType', 'ActorEmail', 'ActionResult', 'When'] },
  { dataset: 'access_requests', requiredFields: ['Action', 'AppDomain', 'CreatedAt'] },
  { dataset: 'gateway_dns', requiredFields: ['QueryName', 'QueryType', 'PolicyName'] },
  { dataset: 'gateway_http', requiredFields: ['URL', 'Action', 'PolicyName', 'HTTPMethod'] },
  { dataset: 'gateway_network', requiredFields: ['DestinationIP', 'Protocol', 'PolicyName'] },
  { dataset: 'workers_trace_events', requiredFields: ['ScriptName', 'Event', 'EventTimestampMs'] },
  { dataset: 'zero_trust_network_sessions', requiredFields: ['SessionStartTime', 'UserEmail', 'DeviceID'] },
  { dataset: 'biso_user_actions', requiredFields: ['Action', 'URL', 'UserEmail', 'Timestamp'] },
  { dataset: 'casb_findings', requiredFields: ['FindingType', 'IntegrationName', 'DetectedTimestamp'] },
  { dataset: 'device_posture_results', requiredFields: ['RuleName', 'DeviceID', 'Result'] },
  { dataset: 'dex_application_tests', requiredFields: ['ApplicationID', 'TestName'] },
  { dataset: 'dex_device_state_events', requiredFields: ['DeviceID', 'StateType'] },
  { dataset: 'dlp_forensic_copies', requiredFields: ['RuleID', 'Content'] },
  { dataset: 'dns_firewall_logs', requiredFields: ['ClusterID', 'QueryName'] },
  { dataset: 'email_security_alerts', requiredFields: ['AlertType', 'Sender', 'Recipient'] },
  { dataset: 'ipsec_logs', requiredFields: ['TunnelID', 'TunnelName'] },
  { dataset: 'magic_ids_detections', requiredFields: ['DetectionID', 'SignatureID'] },
  { dataset: 'network_analytics_logs', requiredFields: ['DestinationIP', 'SourceIP', 'Protocol', 'AttackID'] },
  { dataset: 'sinkhole_http_logs', requiredFields: ['R2Path', 'AccountID'] },
  { dataset: 'ssh_logs', requiredFields: ['UserEmail', 'SessionID'] },
  { dataset: 'warp_config_changes', requiredFields: ['ConfigType', 'OldValue', 'NewValue'] },
  { dataset: 'warp_toggle_changes', requiredFields: ['ToggleType', 'OldState', 'NewState'] }
]

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

/**
 * Detect dataset from log entry fields
 */
function detectDataset(data: Record<string, unknown>): Dataset | null {
  const dataFields = Object.keys(data)
  
  for (const sig of DATASET_SIGNATURES) {
    const hasRequired = sig.requiredFields.every(f => dataFields.includes(f))
    if (hasRequired) {
      return sig.dataset
    }
  }
  
  return null
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  // Debug: log all query params to see what Cloudflare sends
  console.log(`[Ingest] Query params received:`, JSON.stringify(query))

  // Extract auth token from query params
  // Cloudflare sends as ?header_Authorization=Bearer%20TOKEN (URL encoded)
  const authHeader = query['header_Authorization'] as string || ''
  const token = authHeader.replace('Bearer ', '').trim()
  
  const config = useRuntimeConfig()
  
  // Debug: log auth attempt (remove after debugging)
  console.log(`[Ingest Auth] Received token: "${token}", Expected: "${config.ingestAuthToken ? '[SET]' : '[NOT SET]'}"`)
  
  // Validate auth token
  if (!config.ingestAuthToken) {
    console.error('[Ingest] CRITICAL: ingestAuthToken is not configured!')
    throw createError({
      statusCode: 500,
      message: 'Server misconfiguration: authentication token not set'
    })
  }
  
  if (!token || token !== config.ingestAuthToken) {
    console.warn(`[Ingest] Auth failed - token mismatch`)
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

  // Handle Cloudflare destination validation test
  // Cloudflare sends {"content":"tests"} to validate the endpoint
  if (bodyText.includes('"content"') && bodyText.includes('"tests"')) {
    console.log('[Ingest] Received Cloudflare validation test request')
    return { success: true, message: 'Validation successful' }
  }

  // Parse NDJSON (newline-delimited JSON)
  const lines = bodyText.trim().split('\n').filter(line => line.trim())
  
  if (lines.length === 0) {
    return { success: true, message: 'No log entries to process', count: 0 }
  }

  const db = getDatabase()
  const logsToInsert: Array<typeof schema.logs.$inferInsert> = []
  const accountId = config.cloudflareAccountId
  
  // Track detected dataset for response
  let detectedDataset: Dataset | null = null

  for (const line of lines) {
    try {
      const data = JSON.parse(line) as Record<string, unknown>
      
      // Auto-detect dataset from the first valid entry
      const dataset = detectDataset(data)
      if (!dataset) {
        console.warn(`[Ingest] Could not detect dataset for log entry, fields: ${Object.keys(data).slice(0, 10).join(', ')}...`)
        continue
      }
      
      if (!detectedDataset) {
        detectedDataset = dataset
      }
      
      const scope = getDatasetScope(dataset)
      
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
      
      console.log(`[Ingest] Inserted ${logsToInsert.length} logs (detected: ${detectedDataset})`)
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
    dataset: detectedDataset
  }
})
