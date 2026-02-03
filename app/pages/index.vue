<script setup lang="ts">
import { ZONE_DATASET_CONFIGS, ACCOUNT_DATASET_CONFIGS } from '~~/shared/types'

definePageMeta({
  layout: 'default'
})

// Get selected zone from layout state
const selectedZone = useState<string | null>('selectedZone')

// Build query params for stats
const statsQuery = computed(() => {
  const params: Record<string, string> = {}
  if (selectedZone.value) {
    params.zoneId = selectedZone.value
  }
  return params
})

// Fetch stats with zone filter
const { data: stats, refresh: refreshStats } = await useFetch('/api/stats', {
  query: statsQuery,
  watch: [statsQuery]
})
const { data: zonesData } = await useFetch('/api/zones')

// Get selected zone name for display
const selectedZoneName = computed(() => {
  if (!selectedZone.value) return 'All Zones'
  const zone = zonesData.value?.zones?.find((z: any) => z.id === selectedZone.value)
  return zone?.name || 'Unknown Zone'
})

const formatNumber = (n: number) => new Intl.NumberFormat().format(n)

// Zone dataset cards with counts
const zoneDatasetCards = computed(() => {
  const counts = stats.value?.datasetCounts || {}
  return ZONE_DATASET_CONFIGS.map(ds => ({
    label: ds.label,
    dataset: ds.id,
    icon: ds.icon,
    count: counts[ds.id] || 0
  }))
})

// Account dataset cards with counts
const accountDatasetCards = computed(() => {
  const counts = stats.value?.datasetCounts || {}
  return ACCOUNT_DATASET_CONFIGS.map(ds => ({
    label: ds.label,
    dataset: ds.id,
    icon: ds.icon,
    count: counts[ds.id] || 0
  }))
})

// Filter to only show datasets with logs
const activeZoneDatasets = computed(() => zoneDatasetCards.value.filter(d => d.count > 0))
const activeAccountDatasets = computed(() => accountDatasetCards.value.filter(d => d.count > 0))
</script>

<template>
  <div class="dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <div>
        <h1 class="dashboard-title">Dashboard</h1>
        <p class="dashboard-subtitle">
          {{ selectedZone ? `Showing logs for ${selectedZoneName}` : 'Cloudflare Logpush monitoring and analytics' }}
        </p>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon stat-icon-orange">
          <UIcon name="i-heroicons-document-text" class="w-6 h-6" />
        </div>
        <div class="stat-content">
          <p class="stat-label">Total Logs</p>
          <p class="stat-value">{{ formatNumber(stats?.totalLogs || 0) }}</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon stat-icon-orange">
          <UIcon name="i-heroicons-globe-alt" class="w-6 h-6" />
        </div>
        <div class="stat-content">
          <p class="stat-label">Zones</p>
          <p class="stat-value">{{ zonesData?.count || 0 }}</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">
          <UIcon name="i-heroicons-circle-stack" class="w-6 h-6" />
        </div>
        <div class="stat-content">
          <p class="stat-label">Active Datasets</p>
          <p class="stat-value">{{ Object.keys(stats?.datasetCounts || {}).length }}</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon stat-icon-orange">
          <UIcon name="i-heroicons-calendar" class="w-6 h-6" />
        </div>
        <div class="stat-content">
          <p class="stat-label">Logs Today</p>
          <p class="stat-value">{{ formatNumber(stats?.logsToday || 0) }}</p>
        </div>
      </div>
    </div>

    <!-- Zone Datasets -->
    <div class="section" v-if="activeZoneDatasets.length > 0 || !selectedZone">
      <h2 class="section-title">Zone Datasets</h2>
      <div class="dataset-grid">
        <NuxtLink
          v-for="card in zoneDatasetCards"
          :key="card.dataset"
          :to="`/logs/${card.dataset}`"
          class="dataset-card"
          :class="{ 'dataset-card-empty': card.count === 0 }"
        >
          <div class="dataset-card-left">
            <div class="dataset-icon">
              <UIcon :name="card.icon" class="w-5 h-5" />
            </div>
            <div class="dataset-info">
              <p class="dataset-name">{{ card.label }}</p>
              <p class="dataset-count">{{ formatNumber(card.count) }} logs</p>
            </div>
          </div>
          <UIcon name="i-heroicons-chevron-right" class="w-5 h-5 dataset-arrow" />
        </NuxtLink>
      </div>
    </div>

    <!-- Account Datasets -->
    <div class="section" v-if="activeAccountDatasets.length > 0 || !selectedZone">
      <h2 class="section-title">Account Datasets</h2>
      <div class="dataset-grid">
        <NuxtLink
          v-for="card in accountDatasetCards"
          :key="card.dataset"
          :to="`/logs/${card.dataset}`"
          class="dataset-card"
          :class="{ 'dataset-card-empty': card.count === 0 }"
        >
          <div class="dataset-card-left">
            <div class="dataset-icon">
              <UIcon :name="card.icon" class="w-5 h-5" />
            </div>
            <div class="dataset-info">
              <p class="dataset-name">{{ card.label }}</p>
              <p class="dataset-count">{{ formatNumber(card.count) }} logs</p>
            </div>
          </div>
          <UIcon name="i-heroicons-chevron-right" class="w-5 h-5 dataset-arrow" />
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  width: 100%;
}

.dashboard-header {
  margin-bottom: 24px;
}

.dashboard-title {
  font-size: 24px;
  font-weight: 700;
  color: #fafafa;
  margin: 0;
}

.dashboard-subtitle {
  font-size: 14px;
  color: #737373;
  margin-top: 4px;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  background-color: #141414;
  border: 1px solid #262626;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  background-color: #262626;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #737373;
  flex-shrink: 0;
}

.stat-icon-orange {
  background-color: rgba(246, 130, 31, 0.1);
  color: #f6821f;
}

.stat-content {
  min-width: 0;
}

.stat-label {
  font-size: 13px;
  color: #737373;
  margin: 0;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #fafafa;
  margin: 0;
  line-height: 1.2;
}

.stat-value-orange {
  color: #f6821f;
}

/* Section */
.section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #fafafa;
  margin: 0 0 16px 0;
}

/* Dataset Grid */
.dataset-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 1200px) {
  .dataset-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .dataset-grid {
    grid-template-columns: 1fr;
  }
}

.dataset-card {
  background-color: #141414;
  border: 1px solid #262626;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-decoration: none;
  transition: all 0.15s ease;
}

.dataset-card:hover {
  border-color: rgba(246, 130, 31, 0.5);
  background-color: #1a1a1a;
}

.dataset-card-empty {
  opacity: 0.5;
}

.dataset-card-empty:hover {
  opacity: 0.7;
}

.dataset-card-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dataset-icon {
  width: 36px;
  height: 36px;
  background-color: #262626;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f6821f;
}

.dataset-info {
  min-width: 0;
}

.dataset-name {
  font-size: 14px;
  font-weight: 500;
  color: #fafafa;
  margin: 0;
}

.dataset-count {
  font-size: 13px;
  color: #737373;
  margin: 0;
}

.dataset-arrow {
  color: #525252;
  flex-shrink: 0;
}
</style>
