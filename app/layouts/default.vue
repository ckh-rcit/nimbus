<script setup lang="ts">
import { ZONE_DATASET_CONFIGS, ACCOUNT_DATASET_CONFIGS } from '~~/shared/types'

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
const accountLogsExpanded = ref(true)

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
const selectedTimeRange = useState('timeRange', () => '7d')

// Auto-refresh state
const autoRefresh = useState('autoRefresh', () => false)

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
    <!-- Sidebar -->
    <aside class="nimbus-sidebar">
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
        >
          <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4" />
          <span>Dashboard</span>
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
          >
            <UIcon :name="ds.icon" class="w-4 h-4" />
            <span>{{ ds.label }}</span>
          </NuxtLink>
        </div>

        <!-- Account Datasets Section -->
        <div class="nimbus-nav-section">
          <button class="nimbus-nav-section-header" @click="accountLogsExpanded = !accountLogsExpanded">
            <span class="nimbus-nav-title">Account Logs</span>
            <UIcon 
              :name="accountLogsExpanded ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'" 
              class="w-4 h-4 text-neutral-500" 
            />
          </button>
        </div>
        <div v-show="accountLogsExpanded" class="nimbus-nav-group">
          <NuxtLink
            v-for="ds in ACCOUNT_DATASET_CONFIGS"
            :key="ds.id"
            :to="`/logs/${ds.id}`"
            class="nimbus-nav-link"
            :class="{ active: isActive(`/logs/${ds.id}`) }"
            :title="ds.description"
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
</style>
