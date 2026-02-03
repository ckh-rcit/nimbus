// Dataset types supported by NIMBUS
// Zone-scoped datasets (per domain/zone)
export type ZoneDataset = 
  | 'dns_logs'
  | 'firewall_events'
  | 'http_requests'
  | 'nel_reports'
  | 'page_shield_events'
  | 'spectrum_events'
  | 'zaraz_events'

// Account-scoped datasets (account-wide)
export type AccountDataset =
  | 'access_requests'
  | 'audit_logs'
  | 'audit_logs_v2'
  | 'biso_user_actions'
  | 'casb_findings'
  | 'device_posture_results'
  | 'dex_application_tests'
  | 'dex_device_state_events'
  | 'dlp_forensic_copies'
  | 'dns_firewall_logs'
  | 'email_security_alerts'
  | 'gateway_dns'
  | 'gateway_http'
  | 'gateway_network'
  | 'ipsec_logs'
  | 'magic_ids_detections'
  | 'network_analytics_logs'
  | 'sinkhole_http_logs'
  | 'ssh_logs'
  | 'warp_config_changes'
  | 'warp_toggle_changes'
  | 'workers_trace_events'
  | 'zero_trust_network_sessions'

export type Dataset = ZoneDataset | AccountDataset
export type DatasetScope = 'zone' | 'account'

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
  'access_requests',
  'audit_logs',
  'audit_logs_v2',
  'biso_user_actions',
  'casb_findings',
  'device_posture_results',
  'dex_application_tests',
  'dex_device_state_events',
  'dlp_forensic_copies',
  'dns_firewall_logs',
  'email_security_alerts',
  'gateway_dns',
  'gateway_http',
  'gateway_network',
  'ipsec_logs',
  'magic_ids_detections',
  'network_analytics_logs',
  'sinkhole_http_logs',
  'ssh_logs',
  'warp_config_changes',
  'warp_toggle_changes',
  'workers_trace_events',
  'zero_trust_network_sessions'
]

export const ALL_DATASETS: Dataset[] = [...ZONE_DATASETS, ...ACCOUNT_DATASETS]

// Helper to get scope from dataset
export function getDatasetScope(dataset: Dataset): DatasetScope {
  return ZONE_DATASETS.includes(dataset as ZoneDataset) ? 'zone' : 'account'
}

// Dataset display configuration
export interface DatasetConfig {
  id: Dataset
  label: string
  icon: string
  scope: DatasetScope
  description: string
}

// Zone-scoped dataset configs
export const ZONE_DATASET_CONFIGS: DatasetConfig[] = [
  { id: 'http_requests', label: 'HTTP Requests', icon: 'i-heroicons-globe-alt', scope: 'zone', description: 'HTTP request logs with client, edge, and origin details' },
  { id: 'firewall_events', label: 'Firewall Events', icon: 'i-heroicons-shield-check', scope: 'zone', description: 'WAF, rate limiting, and security events' },
  { id: 'dns_logs', label: 'DNS Logs', icon: 'i-heroicons-server', scope: 'zone', description: 'DNS query and response logs' },
  { id: 'spectrum_events', label: 'Spectrum Events', icon: 'i-heroicons-signal', scope: 'zone', description: 'Spectrum TCP/UDP proxy events' },
  { id: 'nel_reports', label: 'NEL Reports', icon: 'i-heroicons-exclamation-triangle', scope: 'zone', description: 'Network Error Logging reports' },
  { id: 'page_shield_events', label: 'Page Shield', icon: 'i-heroicons-document-magnifying-glass', scope: 'zone', description: 'Page Shield script detection events' },
  { id: 'zaraz_events', label: 'Zaraz Events', icon: 'i-heroicons-code-bracket', scope: 'zone', description: 'Zaraz third-party tool events' }
]

// Account-scoped dataset configs  
export const ACCOUNT_DATASET_CONFIGS: DatasetConfig[] = [
  { id: 'audit_logs', label: 'Audit Logs', icon: 'i-heroicons-clipboard-document-list', scope: 'account', description: 'Account audit trail' },
  { id: 'audit_logs_v2', label: 'Audit Logs V2', icon: 'i-heroicons-clipboard-document-list', scope: 'account', description: 'Enhanced audit logs with more detail' },
  { id: 'access_requests', label: 'Access Requests', icon: 'i-heroicons-key', scope: 'account', description: 'Cloudflare Access authentication logs' },
  { id: 'gateway_dns', label: 'Gateway DNS', icon: 'i-heroicons-funnel', scope: 'account', description: 'Zero Trust Gateway DNS logs' },
  { id: 'gateway_http', label: 'Gateway HTTP', icon: 'i-heroicons-funnel', scope: 'account', description: 'Zero Trust Gateway HTTP logs' },
  { id: 'gateway_network', label: 'Gateway Network', icon: 'i-heroicons-funnel', scope: 'account', description: 'Zero Trust Gateway network logs' },
  { id: 'workers_trace_events', label: 'Workers Traces', icon: 'i-heroicons-command-line', scope: 'account', description: 'Cloudflare Workers execution traces' },
  { id: 'zero_trust_network_sessions', label: 'ZT Sessions', icon: 'i-heroicons-lock-closed', scope: 'account', description: 'Zero Trust network session logs' },
  { id: 'biso_user_actions', label: 'Browser Isolation', icon: 'i-heroicons-window', scope: 'account', description: 'Browser Isolation user actions' },
  { id: 'casb_findings', label: 'CASB Findings', icon: 'i-heroicons-magnifying-glass-circle', scope: 'account', description: 'CASB security findings' },
  { id: 'device_posture_results', label: 'Device Posture', icon: 'i-heroicons-device-phone-mobile', scope: 'account', description: 'Device posture check results' },
  { id: 'dex_application_tests', label: 'DEX App Tests', icon: 'i-heroicons-beaker', scope: 'account', description: 'DEX application test results' },
  { id: 'dex_device_state_events', label: 'DEX Device State', icon: 'i-heroicons-computer-desktop', scope: 'account', description: 'DEX device state events' },
  { id: 'dlp_forensic_copies', label: 'DLP Forensics', icon: 'i-heroicons-document-duplicate', scope: 'account', description: 'DLP forensic copies' },
  { id: 'dns_firewall_logs', label: 'DNS Firewall', icon: 'i-heroicons-fire', scope: 'account', description: 'DNS Firewall logs' },
  { id: 'email_security_alerts', label: 'Email Security', icon: 'i-heroicons-envelope', scope: 'account', description: 'Email security alerts' },
  { id: 'ipsec_logs', label: 'IPSec Logs', icon: 'i-heroicons-lock-closed', scope: 'account', description: 'IPSec tunnel logs' },
  { id: 'magic_ids_detections', label: 'Magic IDS', icon: 'i-heroicons-eye', scope: 'account', description: 'Magic IDS detections' },
  { id: 'network_analytics_logs', label: 'Network Analytics', icon: 'i-heroicons-chart-bar', scope: 'account', description: 'Network analytics logs' },
  { id: 'sinkhole_http_logs', label: 'Sinkhole HTTP', icon: 'i-heroicons-no-symbol', scope: 'account', description: 'Sinkhole HTTP logs' },
  { id: 'ssh_logs', label: 'SSH Logs', icon: 'i-heroicons-command-line', scope: 'account', description: 'SSH session logs' },
  { id: 'warp_config_changes', label: 'WARP Config', icon: 'i-heroicons-cog-6-tooth', scope: 'account', description: 'WARP configuration changes' },
  { id: 'warp_toggle_changes', label: 'WARP Toggle', icon: 'i-heroicons-arrow-path', scope: 'account', description: 'WARP toggle state changes' }
]

// All dataset configs combined
export const DATASET_CONFIGS: DatasetConfig[] = [...ZONE_DATASET_CONFIGS, ...ACCOUNT_DATASET_CONFIGS]

// Get config for a specific dataset
export function getDatasetConfig(dataset: Dataset): DatasetConfig | undefined {
  return DATASET_CONFIGS.find(c => c.id === dataset)
}

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
