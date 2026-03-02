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

// Field grouping for friendly detail view
const FIELD_GROUPS: Record<string, Record<string, string[]>> = {
  http_requests: {
    'Request': ['ClientRequestMethod', 'ClientRequestHost', 'ClientRequestPath', 'ClientRequestURI', 'ClientRequestProtocol', 'ClientRequestScheme', 'ClientRequestReferer', 'ClientRequestUserAgent', 'ClientRequestSource', 'ClientRequestBytes', 'ClientDeviceType', 'ClientXRequestedWith', 'Cookies', 'EdgeRequestHost', 'RequestHeaders'],
    'Client': ['ClientIP', 'ClientASN', 'ClientCountry', 'ClientCity', 'ClientRegionCode', 'ClientLatitude', 'ClientLongitude', 'ClientIPClass', 'ClientSrcPort', 'ClientTCPRTTMs'],
    'Response': ['EdgeResponseStatus', 'EdgeResponseContentType', 'EdgeResponseBytes', 'EdgeResponseBodyBytes', 'EdgeResponseCompressionRatio', 'OriginResponseStatus', 'OriginResponseBytes', 'OriginIP', 'OriginResponseHTTPExpires', 'OriginResponseHTTPLastModified', 'ResponseHeaders'],
    'Cache': ['CacheCacheStatus', 'CacheReserveUsed', 'CacheResponseBytes', 'CacheResponseStatus', 'CacheTieredFill'],
    'Performance': ['EdgeStartTimestamp', 'EdgeEndTimestamp', 'EdgeTimeToFirstByteMs', 'OriginDNSResponseTimeMs', 'OriginRequestHeaderSendDurationMs', 'OriginResponseDurationMs', 'OriginResponseHeaderReceiveDurationMs', 'OriginResponseTime', 'OriginTCPHandshakeDurationMs', 'OriginTLSHandshakeDurationMs', 'WorkerCPUTime', 'WorkerWallTimeUs'],
    'Security': ['SecurityAction', 'SecurityActions', 'SecurityRuleID', 'SecurityRuleIDs', 'SecurityRuleDescription', 'SecuritySources', 'WAFAttackScore', 'WAFRCEAttackScore', 'WAFSQLiAttackScore', 'WAFXSSAttackScore', 'WAFFlags', 'WAFMatchedVar', 'ContentScanObjResults', 'ContentScanObjTypes', 'ContentScanObjSizes', 'EdgePathingSrc', 'EdgePathingStatus', 'EdgePathingOp', 'JA3Hash', 'JA4', 'JA4Signals', 'JSDetectionPassed', 'LeakedCredentialCheckResult'],
    'Bot': ['BotScore', 'BotScoreSrc', 'BotTags', 'BotDetectionIDs', 'BotDetectionTags', 'VerifiedBotCategory'],
    'TLS': ['ClientSSLProtocol', 'ClientSSLCipher', 'ClientMTLSAuthStatus', 'ClientMTLSAuthCertFingerprint', 'OriginSSLProtocol'],
    'Edge': ['EdgeColoCode', 'EdgeColoID', 'EdgeCFConnectingO2O', 'EdgeServerIP', 'SmartRouteColoID', 'UpperTierColoID'],
    'Worker': ['WorkerStatus', 'WorkerScriptName', 'WorkerSubrequest', 'WorkerSubrequestCount'],
    'General': ['RayID', 'ParentRayID', 'ZoneName', 'PayPerCrawlStatus']
  },
  firewall_events: {
    'Event': ['Action', 'Source', 'Kind', 'Description', 'RuleID', 'Ref', 'MatchIndex', 'Metadata'],
    'Request': ['ClientRequestHost', 'ClientRequestMethod', 'ClientRequestPath', 'ClientRequestProtocol', 'ClientRequestQuery', 'ClientRequestScheme', 'ClientRequestUserAgent'],
    'Client': ['ClientIP', 'ClientASN', 'ClientASNDescription', 'ClientCountry', 'ClientIPClass', 'ClientRefererHost', 'ClientRefererPath', 'ClientRefererQuery', 'ClientRefererScheme'],
    'Response': ['EdgeResponseStatus', 'OriginResponseStatus', 'EdgeColoCode'],
    'Security': ['ContentScanObjResults', 'ContentScanObjSizes', 'ContentScanObjTypes', 'LeakedCredentialCheckResult'],
    'General': ['Datetime', 'RayID', 'OriginatorRayID']
  },
  dns_logs: {
    'Query': ['QueryName', 'QueryType', 'ResponseCode', 'ResponseCached'],
    'Network': ['SourceIP', 'EDNSSubnet', 'EDNSSubnetLength', 'ColoCode'],
    'General': ['Timestamp']
  }
}

// Group log data fields into categories
function groupLogData(data: Record<string, any>, ds: string): Array<{ group: string; fields: Array<{ key: string; value: any }> }> {
  const groups = FIELD_GROUPS[ds] || {}
  const groupedFields = new Set<string>()
  const result: Array<{ group: string; fields: Array<{ key: string; value: any }> }> = []

  for (const [groupName, fieldNames] of Object.entries(groups)) {
    const fields = fieldNames
      .filter(f => data[f] !== undefined && data[f] !== null && data[f] !== '')
      .map(f => {
        groupedFields.add(f)
        return { key: f, value: data[f] }
      })
    if (fields.length > 0) {
      result.push({ group: groupName, fields })
    }
  }

  // Collect ungrouped fields
  const ungrouped = Object.entries(data)
    .filter(([k]) => !groupedFields.has(k))
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => ({ key: k, value: v }))
  if (ungrouped.length > 0) {
    result.push({ group: 'Other', fields: ungrouped })
  }

  return result
}

// Format field value for display
function formatFieldValue(value: any): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.length === 0 ? '(empty)' : value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// Show raw JSON toggle
const showRawJson = ref<Set<number>>(new Set())
function toggleRawJson(id: number) {
  if (showRawJson.value.has(id)) {
    showRawJson.value.delete(id)
  } else {
    showRawJson.value.add(id)
  }
  showRawJson.value = new Set(showRawJson.value)
}

// Export to CSV
function exportCsv() {
  if (!logs.value.length) return

  // Collect all unique data field keys across all logs
  const dataKeys = new Set<string>()
  for (const log of logs.value) {
    if (log.data && typeof log.data === 'object') {
      for (const key of Object.keys(log.data as Record<string, any>)) {
        dataKeys.add(key)
      }
    }
  }

  const baseHeaders = ['timestamp', 'dataset', 'zoneName', 'clientIp', 'rayId']
  const sortedDataKeys = [...dataKeys].sort()
  const allHeaders = [...baseHeaders, ...sortedDataKeys]

  const rows = logs.value.map(log => {
    const logData = (log.data || {}) as Record<string, any>
    return allHeaders.map(h => {
      let val: any
      if (baseHeaders.includes(h)) {
        val = (log as any)[h]
      } else {
        val = logData[h]
      }
      if (val === null || val === undefined) return ''
      if (typeof val === 'object') return JSON.stringify(val)
      const str = String(val)
      // Escape CSV: wrap in quotes if contains comma, newline, or quote
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return '"' + str.replace(/"/g, '""') + '"'
      }
      return str
    }).join(',')
  })

  const csv = [allHeaders.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${dataset.value}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
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
          color="neutral"
          variant="outline"
          icon="i-heroicons-arrow-down-tray"
          :disabled="logs.length === 0"
          @click="exportCsv()"
        >
          Export CSV
        </UButton>
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
        <div class="field-select-wrapper">
          <select v-model="searchField" class="field-select">
            <option v-for="opt in searchFieldOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <UIcon name="i-heroicons-chevron-down" class="field-select-icon" />
        </div>
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
                    <div class="flex items-center justify-between mb-3">
                      <div class="flex items-center gap-3">
                        <span class="text-sm font-medium text-neutral-400">Log Details</span>
                        <span v-if="log.rayId" class="text-xs bg-neutral-800 px-2 py-1 rounded font-mono text-neutral-400">
                          Ray ID: {{ log.rayId }}
                        </span>
                      </div>
                      <div class="flex items-center gap-2">
                        <button class="detail-toggle" @click.stop="toggleRawJson(log.id)">
                          <UIcon :name="showRawJson.has(log.id) ? 'i-heroicons-table-cells' : 'i-heroicons-code-bracket'" class="w-3.5 h-3.5" />
                          {{ showRawJson.has(log.id) ? 'Formatted' : 'Raw JSON' }}
                        </button>
                      </div>
                    </div>

                    <!-- Formatted view -->
                    <div v-if="!showRawJson.has(log.id)" class="detail-groups">
                      <div v-for="group in groupLogData(log.data as Record<string, any>, dataset)" :key="group.group" class="detail-group">
                        <h4 class="detail-group-title">{{ group.group }}</h4>
                        <div class="detail-fields">
                          <div v-for="field in group.fields" :key="field.key" class="detail-field">
                            <span class="detail-field-key">{{ field.key }}</span>
                            <span class="detail-field-value" :class="{ 'font-mono': typeof field.value === 'number' || field.key.includes('IP') || field.key.includes('ID') }">
                              {{ formatFieldValue(field.value) }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Raw JSON view -->
                    <pre v-else class="log-json">{{ JSON.stringify(log.data, null, 2) }}</pre>
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
        <div class="page-size-wrapper">
          <select v-model="pageSize" class="page-size-select">
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
          </select>
        </div>
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

/* Field Select Dropdown */
.field-select-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.field-select {
  appearance: none;
  padding: 8px 32px 8px 12px;
  font-size: 14px;
  color: #d4d4d4;
  background-color: #171717;
  border: 1px solid #262626;
  border-radius: 6px;
  cursor: pointer;
  min-width: 120px;
}

.field-select:hover {
  border-color: #404040;
}

.field-select:focus {
  outline: none;
  border-color: #f6821f;
}

.field-select option {
  background-color: #171717;
  color: #d4d4d4;
}

.field-select-icon {
  position: absolute;
  right: 10px;
  width: 14px;
  height: 14px;
  color: #737373;
  pointer-events: none;
}

/* Page Size Select */
.page-size-wrapper {
  position: relative;
  display: inline-flex;
}

.page-size-select {
  appearance: none;
  padding: 6px 24px 6px 10px;
  font-size: 13px;
  color: #d4d4d4;
  background-color: #171717;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23737373' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  background-size: 14px;
  border: 1px solid #262626;
  border-radius: 6px;
  cursor: pointer;
  min-width: 60px;
}

.page-size-select:hover {
  border-color: #404040;
}

.page-size-select:focus {
  outline: none;
  border-color: #f6821f;
}

.page-size-select option {
  background-color: #171717;
  color: #d4d4d4;
}

.table-wrapper {
  flex: 1;
  min-height: 0;
  background: #171717;
  border: 1px solid #262626;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-scroll-container {
  flex: 1;
  overflow: auto;
  min-height: 300px;
}

.logs-table {
  width: 100%;
  min-width: max-content;
  border-collapse: collapse;
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

/* Detail toggle button */
.detail-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  color: #a3a3a3;
  background: #262626;
  border: 1px solid #404040;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.detail-toggle:hover {
  background: #333;
  color: #d4d4d4;
}

/* Formatted detail groups */
.detail-groups {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 12px;
}

.detail-group {
  background: #1a1a1a;
  border: 1px solid #262626;
  border-radius: 6px;
  padding: 12px;
}

.detail-group-title {
  font-size: 11px;
  font-weight: 600;
  color: #f6821f;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 8px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid #262626;
}

.detail-fields {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-field {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 3px 0;
  font-size: 12px;
  line-height: 1.4;
}

.detail-field-key {
  color: #737373;
  min-width: 140px;
  flex-shrink: 0;
  word-break: break-all;
}

.detail-field-value {
  color: #d4d4d4;
  word-break: break-all;
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
.table-scroll-container {
  scrollbar-width: thin;
  scrollbar-color: #404040 #171717;
}

.table-scroll-container::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.table-scroll-container::-webkit-scrollbar-track {
  background: #1a1a1a;
  border-radius: 5px;
}

.table-scroll-container::-webkit-scrollbar-thumb {
  background: #404040;
  border-radius: 5px;
  border: 2px solid #1a1a1a;
}

.table-scroll-container::-webkit-scrollbar-thumb:hover {
  background: #525252;
}

.table-scroll-container::-webkit-scrollbar-corner {
  background: #1a1a1a;
}
</style>
