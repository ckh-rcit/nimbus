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
// Using a scoring system - dataset with highest match wins
// Fields are weighted: unique fields score higher
const DATASET_SIGNATURES: Array<{ 
  dataset: Dataset
  // Fields that strongly identify this dataset (2 points each)
  uniqueFields: string[]
  // Common fields that help confirm (1 point each)
  commonFields: string[]
  // Minimum score needed to match
  minScore: number
}> = [
  // Zone-scoped datasets
  { 
    dataset: 'http_requests', 
    uniqueFields: ['EdgeStartTimestamp', 'EdgeResponseStatus', 'EdgeColoCode', 'RayID'],
    commonFields: ['ClientRequestHost', 'ClientRequestMethod', 'ClientIP', 'CacheCacheStatus'],
    minScore: 4
  },
  { 
    dataset: 'firewall_events', 
    uniqueFields: ['Action', 'Source', 'RuleID', 'Datetime', 'Kind'],
    commonFields: ['ClientRequestHost', 'ClientIP', 'EdgeResponseStatus'],
    minScore: 4
  },
  { 
    dataset: 'dns_logs', 
    uniqueFields: ['QueryName', 'QueryType', 'ResponseCode', 'ColoCode'],
    commonFields: ['SourceIP', 'Timestamp', 'ResponseCached'],
    minScore: 4
  },
  { 
    dataset: 'spectrum_events', 
    uniqueFields: ['Application', 'Event', 'OriginIP', 'ConnectTimestamp'],
    commonFields: ['ClientIP', 'Status'],
    minScore: 3
  },
  { 
    dataset: 'nel_reports', 
    uniqueFields: ['Type', 'Body', 'Phase'],
    commonFields: ['URL', 'Timestamp'],
    minScore: 3
  },
  { 
    dataset: 'page_shield_events', 
    uniqueFields: ['ScriptURL', 'PageURL'],
    commonFields: ['Action', 'Timestamp'],
    minScore: 2
  },
  { 
    dataset: 'zaraz_events', 
    uniqueFields: ['EventType', 'Tool', 'ZarazWorkerID'],
    commonFields: ['ClientIP', 'Timestamp'],
    minScore: 2
  },
  
  // Account-scoped datasets
  { 
    dataset: 'audit_logs', 
    uniqueFields: ['ID', 'When', 'ActorEmail', 'ActorType', 'Interface'],
    commonFields: ['ActionType', 'ActionResult', 'ResourceType', 'ActorIP', 'OldValue', 'NewValue'],
    minScore: 3
  },
  { 
    dataset: 'audit_logs_v2', 
    uniqueFields: ['AuditLogID', 'ActionTimestamp', 'ActorContext', 'AccountName'],
    commonFields: ['ActionType', 'ActorEmail', 'ResourceType', 'ActionResult'],
    minScore: 3
  },
  { 
    dataset: 'access_requests', 
    uniqueFields: ['AppDomain', 'AppUUID', 'CreatedAt'],
    commonFields: ['Action', 'UserEmail', 'IPAddress'],
    minScore: 3
  },
  { 
    dataset: 'gateway_dns', 
    uniqueFields: ['QueryName', 'QueryType', 'PolicyName', 'ResolverDecision'],
    commonFields: ['SourceIP', 'Datetime', 'Location'],
    minScore: 4
  },
  { 
    dataset: 'gateway_http', 
    uniqueFields: ['HTTPMethod', 'PolicyName', 'RequestID'],
    commonFields: ['URL', 'Action', 'UserEmail', 'SourceIP'],
    minScore: 3
  },
  { 
    dataset: 'gateway_network', 
    uniqueFields: ['DestinationIP', 'DestinationPort', 'PolicyName', 'SessionID'],
    commonFields: ['Protocol', 'Action', 'SourceIP'],
    minScore: 4
  },
  { 
    dataset: 'workers_trace_events', 
    uniqueFields: ['ScriptName', 'EventTimestampMs', 'DispatchNamespace'],
    commonFields: ['Event', 'Outcome'],
    minScore: 2
  },
  { 
    dataset: 'zero_trust_network_sessions', 
    uniqueFields: ['SessionStartTime', 'DeviceID', 'VirtualNetworkID'],
    commonFields: ['UserEmail', 'SessionState'],
    minScore: 3
  },
  { 
    dataset: 'biso_user_actions', 
    uniqueFields: ['IsolatedSessionID', 'BrowserType'],
    commonFields: ['Action', 'URL', 'UserEmail', 'Timestamp'],
    minScore: 2
  },
  { 
    dataset: 'casb_findings', 
    uniqueFields: ['FindingType', 'IntegrationName', 'IntegrationPolicyVendor'],
    commonFields: ['DetectedTimestamp', 'Severity'],
    minScore: 2
  },
  { 
    dataset: 'device_posture_results', 
    uniqueFields: ['RuleName', 'DeviceID', 'PostureCheckType'],
    commonFields: ['Result', 'Timestamp'],
    minScore: 3
  },
  { 
    dataset: 'dex_application_tests', 
    uniqueFields: ['ApplicationID', 'TestName', 'ColoCode'],
    commonFields: ['Timestamp'],
    minScore: 2
  },
  { 
    dataset: 'dex_device_state_events', 
    uniqueFields: ['DeviceID', 'StateType', 'Version'],
    commonFields: ['Timestamp'],
    minScore: 2
  },
  { 
    dataset: 'dlp_forensic_copies', 
    uniqueFields: ['RuleID', 'Content', 'ProfileID'],
    commonFields: ['Timestamp'],
    minScore: 2
  },
  { 
    dataset: 'dns_firewall_logs', 
    uniqueFields: ['ClusterID', 'UpstreamIP'],
    commonFields: ['QueryName', 'Timestamp'],
    minScore: 2
  },
  { 
    dataset: 'email_security_alerts', 
    uniqueFields: ['AlertType', 'Sender', 'Recipient', 'MessageID'],
    commonFields: ['Timestamp'],
    minScore: 3
  },
  { 
    dataset: 'ipsec_logs', 
    uniqueFields: ['TunnelID', 'TunnelName', 'TunnelHealth'],
    commonFields: ['Timestamp'],
    minScore: 2
  },
  { 
    dataset: 'magic_ids_detections', 
    uniqueFields: ['DetectionID', 'SignatureID', 'SignatureMessage'],
    commonFields: ['Timestamp'],
    minScore: 2
  },
  { 
    dataset: 'network_analytics_logs', 
    uniqueFields: ['AttackID', 'AttackType', 'MitigationType'],
    commonFields: ['DestinationIP', 'SourceIP', 'Protocol', 'Timestamp'],
    minScore: 3
  },
  { 
    dataset: 'sinkhole_http_logs', 
    uniqueFields: ['R2Path', 'SinkholeID'],
    commonFields: ['AccountID', 'Timestamp'],
    minScore: 2
  },
  { 
    dataset: 'ssh_logs', 
    uniqueFields: ['SessionID', 'SSHPublicKey'],
    commonFields: ['UserEmail', 'Timestamp'],
    minScore: 2
  },
  { 
    dataset: 'warp_config_changes', 
    uniqueFields: ['ConfigType', 'DeviceID'],
    commonFields: ['OldValue', 'NewValue', 'Timestamp'],
    minScore: 2
  },
  { 
    dataset: 'warp_toggle_changes', 
    uniqueFields: ['ToggleType', 'DeviceID'],
    commonFields: ['OldState', 'NewState', 'Timestamp'],
    minScore: 2
  }
]

// Field mappings for extracting common fields from different datasets
const TIMESTAMP_FIELDS: Record<string, string> = {
  http_requests: 'EdgeStartTimestamp',
  firewall_events: 'Datetime',
  dns_logs: 'Timestamp',
  audit_logs: 'When',
  audit_logs_v2: 'ActionTimestamp',
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
  firewall_events: 'RayID'
  // Note: dns_logs does not have RayID per Cloudflare docs
}

const CLIENT_IP_FIELDS: Record<string, string> = {
  http_requests: 'ClientIP',
  firewall_events: 'ClientIP',
  dns_logs: 'SourceIP',
  gateway_dns: 'SourceIP',
  gateway_http: 'SourceIP',
  access_requests: 'IPAddress',
  audit_logs: 'ActorIP',
  audit_logs_v2: 'ActorIPAddress'
}

const ZONE_ID_FIELDS: Record<string, string> = {
  http_requests: 'ZoneID',
  firewall_events: 'ZoneID',
  dns_logs: 'ZoneID'
}

// Fields containing host/domain for zone lookup fallback
const HOST_FIELDS: Record<string, string> = {
  http_requests: 'ClientRequestHost',
  firewall_events: 'ClientRequestHost',
  dns_logs: 'QueryName',
  nel_reports: 'URL',
  spectrum_events: 'ClientIP',
  page_shield_events: 'Host',
  zaraz_events: 'ClientRequestHost'
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
 * Detect dataset from log entry fields using scoring
 * Unique fields score 2 points, common fields score 1 point
 * Highest scoring dataset above minimum threshold wins
 */
function detectDataset(data: Record<string, unknown>): Dataset | null {
  const dataFields = new Set(Object.keys(data))
  
  let bestMatch: { dataset: Dataset; score: number } | null = null
  
  for (const sig of DATASET_SIGNATURES) {
    let score = 0
    
    // Unique fields worth 2 points each
    for (const field of sig.uniqueFields) {
      if (dataFields.has(field)) score += 2
    }
    
    // Common fields worth 1 point each
    for (const field of sig.commonFields) {
      if (dataFields.has(field)) score += 1
    }
    
    // Must meet minimum score threshold
    if (score >= sig.minScore) {
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { dataset: sig.dataset, score }
      }
    }
  }
  
  return bestMatch?.dataset || null
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  // Debug: log all query params to see what Cloudflare sends
  console.log(`[Ingest] Query params received:`, JSON.stringify(query))

  // Extract auth token - support multiple formats:
  // 1. Simple: ?token=YOUR_TOKEN
  // 2. Cloudflare header style: ?header_Authorization=Bearer%20YOUR_TOKEN
  let token = ''
  
  if (query['token']) {
    token = (query['token'] as string).trim()
  } else if (query['header_Authorization']) {
    const authHeader = query['header_Authorization'] as string
    token = authHeader.replace('Bearer ', '').trim()
  }
  
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
  
  // Load zones for host-to-zone lookup
  const zones = await db.select({ id: schema.zones.id, name: schema.zones.name }).from(schema.zones)
  const zoneMap = new Map<string, string>()
  for (const zone of zones) {
    zoneMap.set(zone.name.toLowerCase(), zone.id)
  }
  
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
      
      // Extract zoneId - try ZoneID field first, then fall back to host lookup
      let zoneId: string | null = null
      if (scope === 'zone') {
        zoneId = extractField(data, ZONE_ID_FIELDS, dataset)
        
        // If no ZoneID, try to look up by host
        if (!zoneId) {
          const hostField = HOST_FIELDS[dataset]
          if (hostField && data[hostField]) {
            let host = (data[hostField] as string).toLowerCase()
            
            // Extract hostname from URL if needed
            if (host.startsWith('http')) {
              try { host = new URL(host).hostname } catch {}
            }
            
            // Try exact match first, then parent domains
            if (zoneMap.has(host)) {
              zoneId = zoneMap.get(host)!
            } else {
              const parts = host.split('.')
              for (let i = 0; i < parts.length - 1; i++) {
                const parentDomain = parts.slice(i).join('.')
                if (zoneMap.has(parentDomain)) {
                  zoneId = zoneMap.get(parentDomain)!
                  break
                }
              }
            }
          }
        }
      }

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
