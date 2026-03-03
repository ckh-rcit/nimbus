<script setup lang="ts">
import { ZONE_DATASET_CONFIGS } from '~~/shared/types'

// Fetch zones for selector
const { data: zonesData, refresh: refreshZones } = await useFetch('/api/zones')
const zones = computed(() => zonesData.value?.zones || [])

// Selected zone state
const selectedZone = useState<string | null>('selectedZone', () => null)
const selectedZoneOption = computed({
  get: () => selectedZone.value || '',
  set: (val) => { selectedZone.value = val || null }
})

// Collapsible sections state
const zoneLogsExpanded = ref(true)

// Time range state
const timeRanges = [
  { label: 'Last 15 min', value: '15m' },
  { label: 'Last 1 hour', value: '1h' },
  { label: 'Last 6 hours', value: '6h' },
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'All Time', value: 'all' }
]
const selectedTimeRange = useState('timeRange', () => '24h')

// Auto-refresh state
const autoRefresh = useState('autoRefresh', () => false)

// Ingest health check
const { data: healthData, refresh: refreshHealth } = await useFetch('/api/ingest/health')
const healthStatus = computed(() => healthData.value?.status || 'unknown')
const healthMessage = computed(() => {
  if (!healthData.value) return 'Checking ingest status...'
  const msg = healthData.value.message
  if (healthData.value.minutesSinceLastIngest !== null) {
    return `${msg} (${healthData.value.minutesSinceLastIngest}m ago)`
  }
  return msg
})
const healthColor = computed(() => {
  switch (healthStatus.value) {
    case 'healthy': return 'bg-green-500'
    case 'degraded': return 'bg-yellow-500'
    case 'unhealthy': return 'bg-red-500'
    case 'no_data': return 'bg-gray-500'
    default: return 'bg-gray-500'
  }
})

// Auto-refresh health check every 30 seconds
const healthInterval = ref<NodeJS.Timeout | null>(null)
onMounted(() => {
  healthInterval.value = setInterval(() => {
    refreshHealth()
  }, 30000) // 30 seconds
})
onUnmounted(() => {
  if (healthInterval.value) {
    clearInterval(healthInterval.value)
  }
})

// Mobile sidebar state
const sidebarOpen = ref(false)
const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value
}
const closeSidebar = () => {
  sidebarOpen.value = false
}

// Sync zones handler
const syncing = ref(false)
async function handleSyncZones() {
  syncing.value = true
  try {
    await $fetch('/api/zones/sync', { method: 'POST' })
    await refreshZones()
  } finally {
    syncing.value = false
  }
}

// Check if route is active
const route = useRoute()
const isActive = (path: string) => route.path === path
</script>

<template>
  <div class="nimbus-layout">
    <!-- Mobile Overlay -->
    <div 
      v-if="sidebarOpen" 
      class="mobile-overlay"
      @click="closeSidebar"
    />
    
    <!-- Sidebar -->
    <aside class="nimbus-sidebar" :class="{ 'sidebar-open': sidebarOpen }">
      <!-- Logo -->
      <div class="nimbus-logo">
        <NuxtLink to="/" class="nimbus-logo-link">
          <div class="nimbus-logo-icon">
            <UIcon name="i-heroicons-cloud" class="w-5 h-5 text-white" />
          </div>
          <span class="nimbus-logo-text">NIMBUS</span>
        </NuxtLink>
      </div>

      <!-- Navigation -->
      <nav class="nimbus-nav">
        <!-- Dashboard Link -->
        <NuxtLink
          to="/"
          class="nimbus-nav-link"
          :class="{ active: isActive('/') }"
          @click="closeSidebar"
        >
          <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4" />
          <span>Dashboard</span>
        </NuxtLink>

        <!-- Report Link -->
        <NuxtLink
          to="/report"
          class="nimbus-nav-link"
          :class="{ active: isActive('/report') }"
          @click="closeSidebar"
        >
          <UIcon name="i-heroicons-document-chart-bar" class="w-4 h-4" />
          <span>Executive Report</span>
        </NuxtLink>

        <!-- Zone Datasets Section -->
        <div class="nimbus-nav-section">
          <button class="nimbus-nav-section-header" @click="zoneLogsExpanded = !zoneLogsExpanded">
            <span class="nimbus-nav-title">Zone Logs</span>
            <UIcon 
              :name="zoneLogsExpanded ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'" 
              class="w-4 h-4 text-neutral-500" 
            />
          </button>
        </div>
        <div v-show="zoneLogsExpanded" class="nimbus-nav-group">
          <NuxtLink
            v-for="ds in ZONE_DATASET_CONFIGS"
            :key="ds.id"
            :to="`/logs/${ds.id}`"
            class="nimbus-nav-link"
            :class="{ active: isActive(`/logs/${ds.id}`) }"
            :title="ds.description"
            @click="closeSidebar"
          >
            <UIcon :name="ds.icon" class="w-4 h-4" />
            <span>{{ ds.label }}</span>
          </NuxtLink>
        </div>
      </nav>
    </aside>

    <!-- Main Content -->
    <div class="nimbus-main">
      <!-- Header -->
      <header class="nimbus-header">
        <!-- Mobile Menu Button -->
        <button class="mobile-menu-btn" @click="toggleSidebar">
          <UIcon name="i-heroicons-bars-3" class="w-5 h-5" />
        </button>
        
        <!-- Zone Selector -->
        <div class="nimbus-controls-left">
          <div class="nimbus-select-wrapper">
            <select v-model="selectedZoneOption" class="nimbus-select">
              <option value="">All Zones</option>
              <option v-for="z in zones" :key="z.id" :value="z.id">{{ z.name }}</option>
            </select>
            <UIcon name="i-heroicons-chevron-down" class="nimbus-select-icon" />
          </div>
          <button
            class="nimbus-sync-icon-btn"
            :disabled="syncing"
            :title="syncing ? 'Syncing zones...' : 'Sync zones from Cloudflare'"
            @click="handleSyncZones"
          >
            <UIcon 
              name="i-heroicons-arrow-path" 
              class="w-4 h-4"
              :class="{ 'animate-spin': syncing }"
            />
          </button>
          
          <!-- Ingest Health Indicator -->
          <div class="health-indicator" :title="healthMessage" @click="refreshHealth">
            <div class="health-dot" :class="healthColor" />
            <span class="health-label">Ingest</span>
          </div>
        </div>

        <!-- Right Controls -->
        <div class="nimbus-controls-right">
          <!-- Time Range -->
          <div class="nimbus-select-wrapper">
            <select v-model="selectedTimeRange" class="nimbus-select nimbus-select-sm">
              <option v-for="tr in timeRanges" :key="tr.value" :value="tr.value">{{ tr.label }}</option>
            </select>
            <UIcon name="i-heroicons-chevron-down" class="nimbus-select-icon" />
          </div>

          <!-- Auto Refresh -->
          <label class="nimbus-checkbox-label">
            <input type="checkbox" v-model="autoRefresh" class="nimbus-checkbox" />
            <span>Auto</span>
          </label>

          <!-- Refresh Button -->
          <button class="nimbus-btn-primary">
            <UIcon name="i-heroicons-arrow-path" class="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      <!-- Page Content -->
      <main class="nimbus-content">
        <slot />
      </main>

      <!-- Footer -->
      <footer class="nimbus-footer">
        <span>&copy; {{ new Date().getFullYear() }} Chris K. Harris. All rights reserved.</span>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.nimbus-layout {
  min-height: 100vh;
  display: flex;
  background-color: #0a0a0a;
}

/* Sidebar */
.nimbus-sidebar {
  width: 240px;
  border-right: 1px solid #262626;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background-color: #0a0a0a;
}

.nimbus-logo {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid #262626;
}

.nimbus-logo-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.nimbus-logo-icon {
  width: 32px;
  height: 32px;
  background-color: #f6821f;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nimbus-logo-text {
  font-size: 16px;
  font-weight: 600;
  color: #fafafa;
  letter-spacing: -0.025em;
}

/* Navigation */
.nimbus-nav {
  flex: 1;
  overflow-y: auto;
  padding: 16px 12px;
}

.nimbus-nav-section {
  margin-top: 16px;
  margin-bottom: 4px;
}

.nimbus-nav-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 4px 12px;
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nimbus-nav-section-header:hover .nimbus-nav-title {
  color: #a3a3a3;
}

.nimbus-nav-title {
  font-size: 11px;
  font-weight: 500;
  color: #737373;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: color 0.15s ease;
}

.nimbus-nav-group {
  display: flex;
  flex-direction: column;
}

.nimbus-nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #a3a3a3;
  text-decoration: none;
  transition: all 0.15s ease;
  margin-bottom: 2px;
}

.nimbus-nav-link:hover {
  color: #fafafa;
  background-color: #171717;
}

.nimbus-nav-link.active {
  color: #fafafa;
  background-color: #262626;
}

/* Main Content */
.nimbus-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Header */
.nimbus-header {
  height: 56px;
  border-bottom: 1px solid #262626;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
  background-color: #0a0a0a;
}

.nimbus-controls-left,
.nimbus-controls-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Sync Icon Button */
.nimbus-sync-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: #737373;
  background-color: transparent;
  border: 1px solid #262626;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nimbus-sync-icon-btn:hover {
  color: #f6821f;
  border-color: #f6821f;
  background-color: rgba(246, 130, 31, 0.1);
}

.nimbus-sync-icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Health Indicator */
.health-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background-color: #171717;
  border: 1px solid #262626;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.health-indicator:hover {
  border-color: #404040;
  background-color: #1a1a1a;
}

.health-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: all 0.3s ease;
  animation: pulse 2s infinite;
}

.health-label {
  font-size: 13px;
  color: #a3a3a3;
  font-weight: 500;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

/* Select */
.nimbus-select-wrapper {
  position: relative;
}

.nimbus-select {
  appearance: none;
  background-color: #171717;
  border: 1px solid #262626;
  border-radius: 6px;
  padding: 6px 32px 6px 12px;
  font-size: 14px;
  color: #fafafa;
  min-width: 180px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nimbus-select:focus {
  outline: none;
  border-color: #f6821f;
  box-shadow: 0 0 0 1px #f6821f;
}

.nimbus-select-sm {
  min-width: 140px;
}

.nimbus-select-icon {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: #737373;
  pointer-events: none;
}

/* Checkbox */
.nimbus-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #a3a3a3;
}

.nimbus-checkbox {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid #404040;
  background-color: #171717;
  cursor: pointer;
  accent-color: #f6821f;
}

/* Primary Button */
.nimbus-btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  background-color: #f6821f;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nimbus-btn-primary:hover {
  background-color: #e5720d;
}

/* Content Area */
.nimbus-content {
  flex: 1;
  overflow: auto;
  padding: 24px;
  background-color: #0a0a0a;
}

/* Footer */
.nimbus-footer {
  padding: 16px 24px;
  text-align: center;
  font-size: 13px;
  color: #525252;
  border-top: 1px solid #262626;
  background-color: #0a0a0a;
}

/* Mobile Menu Button - Hidden on desktop */
.mobile-menu-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: #fafafa;
  background-color: transparent;
  border: 1px solid #262626;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.mobile-menu-btn:hover {
  background-color: #171717;
  border-color: #f6821f;
}

/* Mobile Overlay */
.mobile-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.75);
  z-index: 998;
}

/* Responsive Styles */
@media (max-width: 768px) {
  .nimbus-layout {
    position: relative;
  }

  /* Mobile Menu Button - Show on mobile */
  .mobile-menu-btn {
    display: flex;
  }

  /* Mobile Overlay - Show when sidebar is open */
  .mobile-overlay {
    display: block;
  }

  /* Sidebar - Off-canvas on mobile */
  .nimbus-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 999;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }

  .nimbus-sidebar.sidebar-open {
    transform: translateX(0);
  }

  /* Header adjustments for mobile */
  .nimbus-header {
    padding: 0 12px;
    height: auto;
    min-height: 56px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .nimbus-controls-left {
    flex: 1;
    min-width: 0;
    gap: 8px;
  }

  .nimbus-controls-right {
    width: 100%;
    order: 3;
    gap: 8px;
    flex-wrap: wrap;
  }

  /* Select elements - Full width on very small screens */
  .nimbus-select-wrapper {
    flex: 1;
  }

  .nimbus-select {
    min-width: 0;
    width: 100%;
    font-size: 13px;
    padding: 6px 28px 6px 10px;
  }

  .nimbus-select-sm {
    min-width: 0;
  }

  /* Primary button - Adjust size */
  .nimbus-btn-primary {
    padding: 6px 12px;
    font-size: 13px;
  }

  /* Content padding */
  .nimbus-content {
    padding: 16px 12px;
  }

  /* Footer */
  .nimbus-footer {
    padding: 12px 16px;
    font-size: 12px;
  }
}

/* Extra small screens */
@media (max-width: 480px) {
  .nimbus-header {
    padding: 0 8px;
  }

  .nimbus-controls-left,
  .nimbus-controls-right {
    gap: 6px;
  }

  .nimbus-select {
    font-size: 12px;
    padding: 5px 24px 5px 8px;
  }

  .nimbus-btn-primary span {
    display: none;
  }

  .nimbus-btn-primary {
    padding: 6px 10px;
  }

  .nimbus-content {
    padding: 12px 8px;
  }

  .nimbus-checkbox-label span {
    font-size: 13px;
  }
}
</style>
