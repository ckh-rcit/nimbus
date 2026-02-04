<script setup lang="ts">
import { DATASET_CONFIGS, type Dataset } from '~~/shared/types'

const route = useRoute()
const dataset = computed(() => route.params.dataset as Dataset)

// Get dataset config
const datasetConfig = computed(() => 
  DATASET_CONFIGS.find(d => d.id === dataset.value)
)

// Validate dataset exists
if (!datasetConfig.value) {
  throw createError({
    statusCode: 404,
    message: `Dataset not found: ${dataset.value}`
  })
}

definePageMeta({
  layout: 'default'
})

// State from layout
const selectedZone = useState<string | null>('selectedZone')
const selectedTimeRange = useState('timeRange', () => '1h')
const autoRefresh = useState('autoRefresh', () => false)

// Search and filters
const searchQuery = ref('')
const debouncedSearch = refDebounced(searchQuery, 300)

// Pagination
const page = ref(1)
const pageSize = ref(50)

// Calculate time range
const timeRangeMs = computed(() => {
  const ranges: Record<string, number> = {
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    'all': 0 // 0 means no time filter
  }
  return ranges[selectedTimeRange.value] ?? ranges['7d']
})

// Build query params
const queryParams = computed(() => {
  const params: Record<string, any> = {
    dataset: dataset.value,
    limit: pageSize.value,
    offset: (page.value - 1) * pageSize.value
  }
  
  // Only add time filters if not 'all'
  if (timeRangeMs.value > 0) {
    params.endTime = new Date().toISOString()
    params.startTime = new Date(Date.now() - timeRangeMs.value).toISOString()
  }
  
  if (selectedZone.value) {
    params.zoneId = selectedZone.value
  }
  
  if (debouncedSearch.value) {
    params.search = debouncedSearch.value
  }
  
  return params
})

// Fetch logs
const { data, pending, refresh } = await useFetch('/api/logs', {
  query: queryParams,
  watch: [queryParams]
})

const logs = computed(() => data.value?.logs || [])
const pagination = computed(() => data.value?.pagination || { total: 0, hasMore: false })

// Auto-refresh interval
let refreshTimer: NodeJS.Timeout | null = null

watch(autoRefresh, (enabled) => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  if (enabled) {
    refreshTimer = setInterval(() => {
      refresh()
    }, 30000)
  }
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})

// Dataset-specific columns configuration
const datasetColumnsConfig: Record<string, Array<{ key: string; label: string }>> = {
  // Zone-scoped datasets
  http_requests: [
    { key: 'data.ClientRequestMethod', label: 'Method' },
    { key: 'data.ClientRequestHost', label: 'Host' },
    { key: 'data.ClientRequestPath', label: 'Path' },
    { key: 'data.EdgeResponseStatus', label: 'Status' },
    { key: 'data.CacheCacheStatus', label: 'Cache' }
  ],
  firewall_events: [
    { key: 'data.Action', label: 'Action' },
    { key: 'data.Source', label: 'Source' },
    { key: 'data.RuleID', label: 'Rule ID' },
    { key: 'data.ClientRequestHost', label: 'Host' },
    { key: 'data.EdgeResponseStatus', label: 'Status' }
  ],
  dns_logs: [
    { key: 'data.QueryName', label: 'Query' },
    { key: 'data.QueryType', label: 'Type' },
    { key: 'data.ResponseCode', label: 'Response' },
    { key: 'data.ResponseCached', label: 'Cached' },
    { key: 'data.ColoCode', label: 'Colo' }
  ],
    spectrum_events: [
      { key: 'data.Application', label: 'Application' },
      { key: 'data.Event', label: 'Event' },
      { key: 'data.OriginIP', label: 'Origin' }
    ],
    nel_reports: [
      { key: 'data.Type', label: 'Type' },
      { key: 'data.URL', label: 'URL' },
      { key: 'data.StatusCode', label: 'Status' }
    ],
    page_shield_events: [
      { key: 'data.ScriptURL', label: 'Script URL' },
      { key: 'data.Action', label: 'Action' }
    ],
    zaraz_events: [
      { key: 'data.EventType', label: 'Event Type' },
      { key: 'data.Tool', label: 'Tool' }
    ],
    
    // Account-scoped datasets
    audit_logs: [
      { key: 'data.ActionType', label: 'Action' },
      { key: 'data.ActorEmail', label: 'Actor' },
      { key: 'data.ResourceType', label: 'Resource' }
    ],
    audit_logs_v2: [
      { key: 'data.ActionType', label: 'Action' },
      { key: 'data.ActorEmail', label: 'Actor' },
      { key: 'data.ResourceType', label: 'Resource' },
      { key: 'data.ActionResult', label: 'Result' }
    ],
    access_requests: [
      { key: 'data.Action', label: 'Action' },
      { key: 'data.AppDomain', label: 'App' },
      { key: 'data.UserEmail', label: 'User' }
    ],
    gateway_dns: [
      { key: 'data.QueryName', label: 'Query' },
      { key: 'data.QueryType', label: 'Type' },
      { key: 'data.PolicyName', label: 'Policy' },
      { key: 'data.ResolvedIPs', label: 'Resolved IPs' }
    ],
    gateway_http: [
      { key: 'data.URL', label: 'URL' },
      { key: 'data.Action', label: 'Action' },
      { key: 'data.PolicyName', label: 'Policy' },
      { key: 'data.UserEmail', label: 'User' }
    ],
    gateway_network: [
      { key: 'data.DestinationIP', label: 'Destination' },
      { key: 'data.Protocol', label: 'Protocol' },
      { key: 'data.PolicyName', label: 'Policy' },
      { key: 'data.Action', label: 'Action' }
    ],
    workers_trace_events: [
      { key: 'data.ScriptName', label: 'Script' },
      { key: 'data.Event', label: 'Event' },
      { key: 'data.Outcome', label: 'Outcome' }
    ],
    zero_trust_network_sessions: [
      { key: 'data.UserEmail', label: 'User' },
      { key: 'data.DeviceName', label: 'Device' },
      { key: 'data.SessionState', label: 'State' }
    ],
    biso_user_actions: [
      { key: 'data.Action', label: 'Action' },
      { key: 'data.URL', label: 'URL' },
      { key: 'data.UserEmail', label: 'User' }
    ],
    casb_findings: [
      { key: 'data.FindingType', label: 'Finding' },
      { key: 'data.IntegrationName', label: 'Integration' },
      { key: 'data.Severity', label: 'Severity' }
    ],
    device_posture_results: [
      { key: 'data.RuleName', label: 'Rule' },
      { key: 'data.DeviceName', label: 'Device' },
      { key: 'data.Result', label: 'Result' }
    ],
    email_security_alerts: [
      { key: 'data.AlertType', label: 'Alert' },
      { key: 'data.Sender', label: 'Sender' },
      { key: 'data.Recipient', label: 'Recipient' }
    ],
    network_analytics_logs: [
      { key: 'data.DestinationIP', label: 'Destination' },
      { key: 'data.Protocol', label: 'Protocol' },
      { key: 'data.Action', label: 'Action' }
    ]
}

// Get dataset-specific columns
const datasetSpecificColumns = computed(() => {
  return datasetColumnsConfig[dataset.value] || []
})

// Row expansion
const expandedRows = ref<Set<number>>(new Set())

function toggleRow(id: number) {
  if (expandedRows.value.has(id)) {
    expandedRows.value.delete(id)
  } else {
    expandedRows.value.add(id)
  }
  expandedRows.value = new Set(expandedRows.value)
}

// Get nested value from object
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj)
}

// Format timestamp
function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleString()
}

// Status badge color
function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'success'
  if (status >= 300 && status < 400) return 'info'
  if (status >= 400 && status < 500) return 'warning'
  if (status >= 500) return 'error'
  return 'neutral'
}

// Action badge color
function getActionColor(action: string): string {
  const colors: Record<string, string> = {
    allow: 'success',
    block: 'error',
    challenge: 'warning',
    jschallenge: 'warning',
    managedchallenge: 'warning',
    log: 'info'
  }
  return colors[action?.toLowerCase()] || 'neutral'
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-orange-500/10 rounded-lg">
          <UIcon :name="datasetConfig?.icon || 'i-heroicons-document-text'" class="w-6 h-6 text-orange-500" />
        </div>
        <div>
          <h1 class="text-xl font-bold text-white">{{ datasetConfig?.label }}</h1>
          <p class="text-sm text-neutral-400">{{ datasetConfig?.description }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <UBadge color="neutral" variant="subtle">
          {{ pagination.total.toLocaleString() }} logs
        </UBadge>
        <UButton
          color="primary"
          variant="soft"
          icon="i-heroicons-arrow-path"
          :loading="pending"
          @click="refresh()"
        >
          Refresh
        </UButton>
      </div>
    </div>

    <!-- Search & Filters -->
    <div class="flex items-center gap-4">
      <UInput
        v-model="searchQuery"
        placeholder="Search logs..."
        icon="i-heroicons-magnifying-glass"
        class="flex-1 max-w-md"
        :loading="pending && !!searchQuery"
      />
    </div>

    <!-- Table -->
    <div class="logs-table-container">
      <table class="logs-table">
        <thead>
          <tr>
            <th>Time</th>
            <th v-if="datasetConfig?.scope === 'zone' && !selectedZone">Zone</th>
            <th>Client IP</th>
            <th v-for="col in datasetSpecificColumns" :key="col.key">{{ col.label }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="pending && logs.length === 0">
            <td :colspan="datasetSpecificColumns.length + (datasetConfig?.scope === 'zone' && !selectedZone ? 4 : 3)" class="text-center py-8 text-neutral-500">
              Loading...
            </td>
          </tr>
          <tr v-else-if="logs.length === 0">
            <td :colspan="datasetSpecificColumns.length + (datasetConfig?.scope === 'zone' && !selectedZone ? 4 : 3)" class="text-center py-8 text-neutral-500">
              No logs found
            </td>
          </tr>
          <template v-for="log in logs" :key="log.id">
            <tr class="log-row" @click="toggleRow(log.id)">
              <td class="font-mono text-sm text-neutral-400">{{ formatTime(log.timestamp) }}</td>
              <td v-if="datasetConfig?.scope === 'zone' && !selectedZone" class="text-sm">
                <span class="text-orange-400">{{ log.zoneName || '-' }}</span>
              </td>
              <td class="font-mono text-sm">{{ log.clientIp || '-' }}</td>
              <td v-for="col in datasetSpecificColumns" :key="col.key">
                <span v-if="col.key.startsWith('data.')">{{ getNestedValue(log, col.key) || '-' }}</span>
                <span v-else>{{ log[col.key] || '-' }}</span>
              </td>
              <td>
                <UIcon 
                  :name="expandedRows.has(log.id) ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" 
                  class="w-4 h-4 text-neutral-500"
                />
              </td>
            </tr>
            <tr v-if="expandedRows.has(log.id)" class="expanded-row">
              <td :colspan="datasetSpecificColumns.length + (datasetConfig?.scope === 'zone' && !selectedZone ? 4 : 3)">
                <div class="expanded-content">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-neutral-400">Full Log Data</span>
                    <span v-if="log.rayId" class="text-xs bg-neutral-800 px-2 py-1 rounded">
                      Ray ID: {{ log.rayId }}
                    </span>
                  </div>
                  <pre class="log-json">{{ JSON.stringify(log.data, null, 2) }}</pre>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="pagination-bar">
      <div class="text-sm text-neutral-400">
        Showing {{ ((page - 1) * pageSize) + 1 }} - {{ Math.min(page * pageSize, pagination.total) }} of {{ pagination.total.toLocaleString() }}
      </div>
      <div class="flex items-center gap-2">
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          :disabled="page <= 1"
          @click="page--"
        >
          Previous
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          :disabled="!pagination.hasMore"
          @click="page++"
        >
          Next
        </UButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.logs-table-container {
  background: #171717;
  border: 1px solid #262626;
  border-radius: 8px;
  overflow: hidden;
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
}

.logs-table thead {
  background: #1a1a1a;
}

.logs-table th {
  text-align: left;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 500;
  color: #737373;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #262626;
}

.logs-table td {
  padding: 12px 16px;
  font-size: 14px;
  color: #d4d4d4;
  border-bottom: 1px solid #262626;
}

.log-row {
  cursor: pointer;
  transition: background 0.15s ease;
}

.log-row:hover {
  background: #1f1f1f;
}

.expanded-row {
  background: #0f0f0f;
}

.expanded-content {
  padding: 16px;
}

.log-json {
  font-size: 12px;
  color: #a3a3a3;
  background: #171717;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  max-height: 400px;
  margin: 0;
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #171717;
  border: 1px solid #262626;
  border-radius: 8px;
}
</style>
