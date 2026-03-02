// Dataset types supported by NIMBUS
// Zone-scoped datasets (per domain/zone)
export type ZoneDataset = 
  | 'dns_logs'
  | 'firewall_events'
  | 'http_requests'

export type Dataset = ZoneDataset
export type DatasetScope = 'zone'

export const ZONE_DATASETS: ZoneDataset[] = [
  'dns_logs',
  'firewall_events', 
  'http_requests'
]

export const ALL_DATASETS: Dataset[] = [...ZONE_DATASETS]

// Helper to get scope from dataset
export function getDatasetScope(dataset: Dataset): DatasetScope {
  return 'zone'
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
  { id: 'dns_logs', label: 'DNS Logs', icon: 'i-heroicons-server', scope: 'zone', description: 'DNS query and response logs' }
]

// All dataset configs combined
export const DATASET_CONFIGS: DatasetConfig[] = [...ZONE_DATASET_CONFIGS]

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
