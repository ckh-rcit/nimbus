// Dataset types supported by NIMBUS
export type ZoneDataset = 
  | 'dns_logs'
  | 'firewall_events'
  | 'http_requests'
  | 'nel_reports'
  | 'page_shield_events'
  | 'spectrum_events'
  | 'zaraz_events'

export type AccountDataset =
  | 'audit_logs'
  | 'audit_logs_v2'
  | 'access_requests'
  | 'gateway_dns'
  | 'gateway_http'
  | 'gateway_network'
  | 'workers_trace_events'
  | 'zero_trust_network_sessions'

export type Dataset = ZoneDataset | AccountDataset

export const ZONE_DATASETS: ZoneDataset[] = [
  'dns_logs',
  'firewall_events', 
  'http_requests',
  'nel_reports',
  'page_shield_events',
  'spectrum_events',
  'zaraz_events'
]

export const ACCOUNT_DATASETS: AccountDataset[] = [
  'audit_logs',
  'audit_logs_v2',
  'access_requests',
  'gateway_dns',
  'gateway_http',
  'gateway_network',
  'workers_trace_events',
  'zero_trust_network_sessions'
]

export const ALL_DATASETS: Dataset[] = [...ZONE_DATASETS, ...ACCOUNT_DATASETS]

// Dataset display configuration
export interface DatasetConfig {
  id: Dataset
  label: string
  icon: string
  scope: 'zone' | 'account'
  description: string
}

export const DATASET_CONFIGS: DatasetConfig[] = [
  // Zone-scoped
  { id: 'http_requests', label: 'HTTP Requests', icon: 'i-heroicons-globe-alt', scope: 'zone', description: 'HTTP request logs with client, edge, and origin details' },
  { id: 'firewall_events', label: 'Firewall Events', icon: 'i-heroicons-shield-check', scope: 'zone', description: 'WAF, rate limiting, and security events' },
  { id: 'dns_logs', label: 'DNS Logs', icon: 'i-heroicons-server', scope: 'zone', description: 'DNS query and response logs' },
  { id: 'spectrum_events', label: 'Spectrum Events', icon: 'i-heroicons-signal', scope: 'zone', description: 'Spectrum TCP/UDP proxy events' },
  { id: 'nel_reports', label: 'NEL Reports', icon: 'i-heroicons-exclamation-triangle', scope: 'zone', description: 'Network Error Logging reports' },
  { id: 'page_shield_events', label: 'Page Shield', icon: 'i-heroicons-document-magnifying-glass', scope: 'zone', description: 'Page Shield script detection events' },
  { id: 'zaraz_events', label: 'Zaraz Events', icon: 'i-heroicons-code-bracket', scope: 'zone', description: 'Zaraz third-party tool events' },
  // Account-scoped
  { id: 'audit_logs', label: 'Audit Logs', icon: 'i-heroicons-clipboard-document-list', scope: 'account', description: 'Account audit trail' },
  { id: 'audit_logs_v2', label: 'Audit Logs V2', icon: 'i-heroicons-clipboard-document-list', scope: 'account', description: 'Enhanced audit logs with more detail' },
  { id: 'access_requests', label: 'Access Requests', icon: 'i-heroicons-key', scope: 'account', description: 'Cloudflare Access authentication logs' },
  { id: 'gateway_dns', label: 'Gateway DNS', icon: 'i-heroicons-funnel', scope: 'account', description: 'Zero Trust Gateway DNS logs' },
  { id: 'gateway_http', label: 'Gateway HTTP', icon: 'i-heroicons-funnel', scope: 'account', description: 'Zero Trust Gateway HTTP logs' },
  { id: 'gateway_network', label: 'Gateway Network', icon: 'i-heroicons-funnel', scope: 'account', description: 'Zero Trust Gateway network logs' },
  { id: 'workers_trace_events', label: 'Workers Traces', icon: 'i-heroicons-command-line', scope: 'account', description: 'Cloudflare Workers execution traces' },
  { id: 'zero_trust_network_sessions', label: 'ZT Network Sessions', icon: 'i-heroicons-lock-closed', scope: 'account', description: 'Zero Trust network session logs' }
]

// Cloudflare Zone from API
export interface CloudflareZone {
  id: string
  name: string
  status: string
  account: {
    id: string
    name: string
  }
  created_on: string
  modified_on: string
}

// Zone stored in database
export interface Zone {
  id: string
  name: string
  status: string
  accountId: string
  syncedAt: Date
}

// Log entry stored in database
export interface LogEntry {
  id: number
  dataset: Dataset
  zoneId: string | null
  accountId: string | null
  timestamp: Date
  rayId: string | null
  clientIp: string | null
  data: Record<string, unknown>
  createdAt: Date
}

// API query parameters for logs
export interface LogQueryParams {
  dataset?: Dataset
  zoneId?: string
  accountId?: string
  search?: string
  startTime?: string
  endTime?: string
  limit?: number
  offset?: number
}

// Cloudflare API response wrapper
export interface CloudflareApiResponse<T> {
  success: boolean
  errors: Array<{ code: number; message: string }>
  messages: Array<{ code: number; message: string }>
  result: T
  result_info?: {
    page: number
    per_page: number
    total_pages: number
    count: number
    total_count: number
  }
}
