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
const searchField = ref<string | null>(null)

// Filter state
const activeFilters = ref<Array<{ field: string; value: string }>>([])

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
    if (searchField.value) {
      params.searchField = searchField.value
    }
  }
  
  // Add active filters
  if (activeFilters.value.length > 0) {
    params.filters = JSON.stringify(activeFilters.value)
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
    { key: 'data.ClientRequestPath', label: 'Path' },
    { key: 'data.EdgeColoCode', label: 'Colo' }
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

// Format cell value - handles falsy values like 0 and false
function formatCellValue(value: any): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === '') return '-'
  return String(value)
}

// Column resizing
const columnWidths = ref<Record<string, number>>({})
const resizing = ref<{ col: string; startX: number; startWidth: number } | null>(null)

function startResize(event: MouseEvent, col: string) {
  event.preventDefault()
  event.stopPropagation()
  const th = (event.target as HTMLElement).closest('th')
  if (!th) return
  
  resizing.value = {
    col,
    startX: event.clientX,
    startWidth: columnWidths.value[col] || th.offsetWidth
  }
  
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(event: MouseEvent) {
  if (!resizing.value) return
  const delta = event.clientX - resizing.value.startX
  const newWidth = Math.max(80, resizing.value.startWidth + delta)
  columnWidths.value[resizing.value.col] = newWidth
}

function stopResize() {
  resizing.value = null
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

// Search field options for filtering
const searchFieldOptions = computed(() => {
  const options = [
    { label: 'All fields', value: null },
    { label: 'Client IP', value: 'clientIp' },
    { label: 'Ray ID', value: 'rayId' }
  ]
  
  // Add dataset-specific fields
  for (const col of datasetSpecificColumns.value) {
    options.push({ label: col.label, value: col.key })
  }
  
  return options
})

// Add quick filter from cell value
function addFilter(field: string, value: any) {
  if (value === null || value === undefined || value === '-') return
  const strValue = String(value)
  
  // Check if filter already exists
  const exists = activeFilters.value.some(f => f.field === field && f.value === strValue)
  if (!exists) {
    activeFilters.value = [...activeFilters.value, { field, value: strValue }]
  }
}

function removeFilter(index: number) {
  activeFilters.value = activeFilters.value.filter((_, i) => i !== index)
}

function clearFilters() {
  activeFilters.value = []
  searchQuery.value = ''
  searchField.value = null
}

// Get column style with width
function getColumnStyle(col: string) {
  const width = columnWidths.value[col]
  return width ? { width: `${width}px`, minWidth: `${width}px` } : {}
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
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

    <!-- Search & Filters Bar -->
    <div class="filters-bar">
      <div class="flex items-center gap-2 flex-1">
        <USelectMenu
          v-model="searchField"
          :options="searchFieldOptions"
          value-attribute="value"
          option-attribute="label"
          placeholder="Field"
          class="w-36"
        />
        <UInput
          v-model="searchQuery"
          placeholder="Search..."
          icon="i-heroicons-magnifying-glass"
          class="flex-1 max-w-sm"
          :loading="pending && !!searchQuery"
        >
          <template #trailing>
            <UButton
              v-if="searchQuery"
              color="neutral"
              variant="link"
              icon="i-heroicons-x-mark"
              size="xs"
              @click="searchQuery = ''"
            />
          </template>
        </UInput>
      </div>
      
      <div v-if="activeFilters.length > 0" class="flex items-center gap-2 ml-4">
        <span class="text-xs text-neutral-500">Filters:</span>
        <div class="flex flex-wrap gap-1">
          <UBadge
            v-for="(filter, idx) in activeFilters"
            :key="idx"
            color="primary"
            variant="subtle"
            class="cursor-pointer hover:opacity-80"
            @click="removeFilter(idx)"
          >
            {{ filter.field.split('.').pop() }}: {{ filter.value }}
            <UIcon name="i-heroicons-x-mark" class="w-3 h-3 ml-1" />
          </UBadge>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          @click="clearFilters"
        >
          Clear all
        </UButton>
      </div>
    </div>

    <!-- Table Container -->
    <div class="table-wrapper">
      <div class="table-scroll-container">
        <table class="logs-table" :class="{ 'is-resizing': resizing }">
          <thead>
            <tr>
              <th :style="getColumnStyle('time')">
                <div class="th-content">
                  <span>Time</span>
                  <div class="resize-handle" @mousedown="startResize($event, 'time')"></div>
                </div>
              </th>
              <th v-if="datasetConfig?.scope === 'zone' && !selectedZone" :style="getColumnStyle('zone')">
                <div class="th-content">
                  <span>Zone</span>
                  <div class="resize-handle" @mousedown="startResize($event, 'zone')"></div>
                </div>
              </th>
              <th :style="getColumnStyle('clientIp')">
                <div class="th-content">
                  <span>Client IP</span>
                  <div class="resize-handle" @mousedown="startResize($event, 'clientIp')"></div>
                </div>
              </th>
              <th v-for="col in datasetSpecificColumns" :key="col.key" :style="getColumnStyle(col.key)">
                <div class="th-content">
                  <span>{{ col.label }}</span>
                  <div class="resize-handle" @mousedown="startResize($event, col.key)"></div>
                </div>
              </th>
              <th class="w-10"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pending && logs.length === 0">
              <td :colspan="datasetSpecificColumns.length + (datasetConfig?.scope === 'zone' && !selectedZone ? 4 : 3)" class="text-center py-8 text-neutral-500">
                <div class="flex items-center justify-center gap-2">
                  <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              </td>
            </tr>
            <tr v-else-if="logs.length === 0">
              <td :colspan="datasetSpecificColumns.length + (datasetConfig?.scope === 'zone' && !selectedZone ? 4 : 3)" class="text-center py-8 text-neutral-500">
                <div class="flex flex-col items-center gap-2">
                  <UIcon name="i-heroicons-inbox" class="w-8 h-8" />
                  <span>No logs found</span>
                  <span v-if="searchQuery || activeFilters.length" class="text-xs">Try adjusting your search or filters</span>
                </div>
              </td>
            </tr>
            <template v-for="log in logs" :key="log.id">
              <tr class="log-row" @click="toggleRow(log.id)">
                <td class="font-mono text-sm text-neutral-400 whitespace-nowrap">{{ formatTime(log.timestamp) }}</td>
                <td v-if="datasetConfig?.scope === 'zone' && !selectedZone" class="text-sm">
                  <span 
                    class="text-orange-400 hover:underline cursor-pointer" 
                    @click.stop="addFilter('zoneName', log.zoneName)"
                  >
                    {{ log.zoneName || '-' }}
                  </span>
                </td>
                <td class="font-mono text-sm">
                  <span 
                    class="hover:text-orange-400 cursor-pointer transition-colors"
                    @click.stop="addFilter('clientIp', log.clientIp)"
                  >
                    {{ log.clientIp || '-' }}
                  </span>
                </td>
                <td v-for="col in datasetSpecificColumns" :key="col.key" class="cell-content">
                  <span 
                    v-if="col.key.startsWith('data.')"
                    class="hover:text-orange-400 cursor-pointer transition-colors"
                    @click.stop="addFilter(col.key, getNestedValue(log, col.key))"
                  >
                    {{ formatCellValue(getNestedValue(log, col.key)) }}
                  </span>
                  <span 
                    v-else
                    class="hover:text-orange-400 cursor-pointer transition-colors"
                    @click.stop="addFilter(col.key, log[col.key])"
                  >
                    {{ formatCellValue(log[col.key]) }}
                  </span>
                </td>
                <td class="w-10">
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
                      <span v-if="log.rayId" class="text-xs bg-neutral-800 px-2 py-1 rounded font-mono">
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
    </div>

    <!-- Pagination -->
    <div class="pagination-bar">
      <div class="flex items-center gap-4">
        <span class="text-sm text-neutral-400">
          Showing {{ logs.length > 0 ? ((page - 1) * pageSize) + 1 : 0 }} - {{ Math.min(page * pageSize, pagination.total) }} of {{ pagination.total.toLocaleString() }}
        </span>
        <USelectMenu
          v-model="pageSize"
          :options="[25, 50, 100, 200]"
          class="w-20"
        />
        <span class="text-xs text-neutral-500">per page</span>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-heroicons-chevron-left"
          :disabled="page <= 1"
          @click="page--"
        >
          Previous
        </UButton>
        <span class="text-sm text-neutral-400 px-2">Page {{ page }}</span>
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-heroicons-chevron-right"
          trailing
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
.filters-bar {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #171717;
  border: 1px solid #262626;
  border-radius: 8px;
  margin-bottom: 16px;
}

.table-wrapper {
  flex: 1;
  min-height: 0;
  background: #171717;
  border: 1px solid #262626;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.table-scroll-container {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

.logs-table {
  width: 100%;
  min-width: max-content;
  border-collapse: collapse;
  table-layout: fixed;
}

.logs-table.is-resizing {
  user-select: none;
  cursor: col-resize;
}

.logs-table thead {
  background: #1a1a1a;
  position: sticky;
  top: 0;
  z-index: 10;
}

.logs-table th {
  text-align: left;
  padding: 0;
  font-size: 12px;
  font-weight: 500;
  color: #737373;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #262626;
  position: relative;
  min-width: 80px;
}

.th-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
}

.resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.15s;
}

.resize-handle:hover,
.is-resizing .resize-handle {
  background: #f6821f;
}

.logs-table td {
  padding: 12px 16px;
  font-size: 14px;
  color: #d4d4d4;
  border-bottom: 1px solid #262626;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-content {
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
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
  white-space: pre-wrap;
  word-break: break-all;
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #171717;
  border: 1px solid #262626;
  border-radius: 8px;
  margin-top: 16px;
  flex-shrink: 0;
}

/* Scrollbar styling */
.table-scroll-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.table-scroll-container::-webkit-scrollbar-track {
  background: #171717;
}

.table-scroll-container::-webkit-scrollbar-thumb {
  background: #404040;
  border-radius: 4px;
}

.table-scroll-container::-webkit-scrollbar-thumb:hover {
  background: #525252;
}

.table-scroll-container::-webkit-scrollbar-corner {
  background: #171717;
}
</style>
