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
    '30d': 30 * 24 * 60 * 60 * 1000
  }
  return ranges[selectedTimeRange.value] || ranges['1h']
})

// Build query params
const queryParams = computed(() => {
  const params: Record<string, any> = {
    dataset: dataset.value,
    limit: pageSize.value,
    offset: (page.value - 1) * pageSize.value,
    endTime: new Date().toISOString(),
    startTime: new Date(Date.now() - timeRangeMs.value).toISOString()
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

// Column configuration based on dataset
const columns = computed(() => {
  const baseColumns = [
    { key: 'timestamp', label: 'Time' },
    { key: 'clientIp', label: 'Client IP' }
  ]
  
  const datasetColumns: Record<string, Array<{ key: string; label: string }>> = {
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
      { key: 'data.ClientRequestHost', label: 'Host' },
      { key: 'data.ClientRequestPath', label: 'Path' }
    ],
    dns_logs: [
      { key: 'data.QueryName', label: 'Query' },
      { key: 'data.QueryType', label: 'Type' },
      { key: 'data.ResponseCode', label: 'Response' },
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
  
  return [...baseColumns, ...(datasetColumns[dataset.value] || []), { key: 'actions', label: '' }]
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
    <UCard class="bg-neutral-900 border-neutral-800 overflow-hidden">
      <UTable
        :data="logs"
        :columns="columns"
        :loading="pending"
        :ui="{
          thead: 'bg-neutral-800',
          th: 'text-neutral-400 font-medium',
          td: 'text-neutral-300',
          tr: 'hover:bg-neutral-800/50 border-neutral-800'
        }"
      >
        <template #timestamp-cell="{ row }">
          <span class="text-sm font-mono text-neutral-400">
            {{ formatTime(row.original.timestamp) }}
          </span>
        </template>

        <template #clientIp-cell="{ row }">
          <span class="font-mono text-sm">{{ row.original.clientIp || '-' }}</span>
        </template>

        <template #data.EdgeResponseStatus-cell="{ row }">
          <UBadge 
            v-if="row.original.data?.EdgeResponseStatus"
            :color="getStatusColor(row.original.data.EdgeResponseStatus)"
            variant="subtle"
          >
            {{ row.original.data.EdgeResponseStatus }}
          </UBadge>
          <span v-else class="text-neutral-500">-</span>
        </template>

        <template #data.Action-cell="{ row }">
          <UBadge 
            v-if="row.original.data?.Action"
            :color="getActionColor(row.original.data.Action)"
            variant="subtle"
          >
            {{ row.original.data.Action }}
          </UBadge>
          <span v-else class="text-neutral-500">-</span>
        </template>

        <template #data.ClientRequestMethod-cell="{ row }">
          <UBadge color="neutral" variant="subtle">
            {{ row.original.data?.ClientRequestMethod || '-' }}
          </UBadge>
        </template>

        <template #data.CacheCacheStatus-cell="{ row }">
          <UBadge 
            v-if="row.original.data?.CacheCacheStatus"
            :color="row.original.data.CacheCacheStatus === 'hit' ? 'success' : 'neutral'"
            variant="subtle"
          >
            {{ row.original.data.CacheCacheStatus }}
          </UBadge>
          <span v-else class="text-neutral-500">-</span>
        </template>

        <template #actions-cell="{ row }">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            :icon="expandedRows.has(row.original.id) ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
            @click="toggleRow(row.original.id)"
          />
        </template>
      </UTable>

      <!-- Expanded Row Details -->
      <template v-for="log in logs" :key="`expanded-${log.id}`">
        <div
          v-if="expandedRows.has(log.id)"
          class="bg-neutral-950 border-t border-neutral-800 p-4"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-neutral-400">Full Log Data</span>
            <UBadge v-if="log.rayId" color="neutral" variant="subtle">
              Ray ID: {{ log.rayId }}
            </UBadge>
          </div>
          <pre class="text-xs text-neutral-300 bg-neutral-900 p-4 rounded-lg overflow-auto max-h-96">{{ JSON.stringify(log.data, null, 2) }}</pre>
        </div>
      </template>

      <!-- Pagination -->
      <div class="flex items-center justify-between px-4 py-3 border-t border-neutral-800">
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
    </UCard>
  </div>
</template>
