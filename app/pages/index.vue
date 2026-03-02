<script setup lang="ts">
import { ZONE_DATASET_CONFIGS } from '~~/shared/types'

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

// Use lazy fetches so the page renders instantly with skeletons
const { data: stats, status: statsStatus } = useLazyFetch('/api/stats', {
  query: statsQuery,
  watch: [statsQuery]
})
const { data: zonesData } = useLazyFetch('/api/zones')

const { data: topTalkers, status: talkersStatus } = useLazyFetch('/api/stats/top-talkers', {
  query: statsQuery,
  watch: [statsQuery]
})

// Loading helpers
const statsLoading = computed(() => statsStatus.value === 'pending')
const talkersLoading = computed(() => talkersStatus.value === 'pending')

// Get selected zone name for display
const selectedZoneName = computed(() => {
  if (!selectedZone.value) return 'All Zones'
  const zone = zonesData.value?.zones?.find((z: any) => z.id === selectedZone.value)
  return zone?.name || 'Unknown Zone'
})

const formatNumber = (n: number) => new Intl.NumberFormat().format(n)

// Relative time formatter
function timeAgo(timestamp: string | null | undefined): string {
  if (!timestamp) return 'Never'
  const diff = Date.now() - new Date(timestamp).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// Zone dataset cards with counts and last seen
const zoneDatasetCards = computed(() => {
  const counts = stats.value?.datasetCounts || {}
  const latest = stats.value?.latestByDataset || {}
  return ZONE_DATASET_CONFIGS.map(ds => ({
    label: ds.label,
    dataset: ds.id,
    icon: ds.icon,
    count: counts[ds.id] || 0,
    lastSeen: latest[ds.id] || null
  }))
})

// Filter to only show datasets with logs
const activeZoneDatasets = computed(() => zoneDatasetCards.value.filter(d => d.count > 0))

// Max count for bar width calculation
function barWidth(count: number, items: Array<{ count: number }>): string {
  const max = Math.max(...items.map(i => i.count), 1)
  return `${Math.max((count / max) * 100, 2)}%`
}
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
      <template v-if="statsLoading">
        <div v-for="i in 4" :key="i" class="stat-card">
          <div class="stat-icon skeleton-icon"></div>
          <div class="stat-content">
            <div class="skeleton-line skeleton-label"></div>
            <div class="skeleton-line skeleton-value"></div>
          </div>
        </div>
      </template>
      <template v-else>
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
      </template>
    </div>

    <!-- Zone Datasets -->
    <div class="section">
      <h2 class="section-title">Zone Datasets</h2>
      <div class="dataset-grid" v-if="statsLoading">
        <div v-for="i in 3" :key="i" class="dataset-card">
          <div class="dataset-card-left">
            <div class="dataset-icon skeleton-icon-sm"></div>
            <div class="dataset-info">
              <div class="skeleton-line skeleton-name"></div>
              <div class="skeleton-line skeleton-count"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="dataset-grid" v-else-if="activeZoneDatasets.length > 0 || !selectedZone">
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
              <p class="dataset-last-seen" :class="{ 'stale': !card.lastSeen }">
                <UIcon name="i-heroicons-clock" class="w-3 h-3" />
                {{ timeAgo(card.lastSeen) }}
              </p>
            </div>
          </div>
          <UIcon name="i-heroicons-chevron-right" class="w-5 h-5 dataset-arrow" />
        </NuxtLink>
      </div>
    </div>

    <!-- Top Talkers -->
    <div class="section">
      <h2 class="section-title">Top Talkers <span class="section-subtitle">(last 24h)</span></h2>
      <!-- Skeleton state -->
      <div class="talkers-grid" v-if="talkersLoading">
        <div v-for="i in 4" :key="i" class="talker-card">
          <div class="skeleton-line skeleton-talker-title"></div>
          <div class="talker-list">
            <div v-for="j in 3" :key="j" class="talker-item">
              <div class="talker-info">
                <div class="skeleton-line skeleton-talker-label"></div>
                <div class="skeleton-line skeleton-talker-count"></div>
              </div>
              <div class="talker-bar-track">
                <div class="talker-bar skeleton-bar" :style="{ width: (90 - j * 20) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Loaded state -->
      <div class="talkers-grid" v-else-if="topTalkers && (topTalkers.topIps?.length || topTalkers.topHosts?.length)">
        <!-- Top Client IPs -->
        <div class="talker-card" v-if="topTalkers.topIps?.length">
          <h3 class="talker-title" title="The devices or users sending the most requests to your sites. A single IP generating unusually high traffic may indicate a bot, scraper, or potential attack.">
            <UIcon name="i-heroicons-user" class="w-4 h-4" />
            Top Client IPs
          </h3>
          <div class="talker-list">
            <div v-for="item in topTalkers.topIps" :key="item.value" class="talker-item">
              <div class="talker-info">
                <span class="talker-value font-mono">{{ item.value }}</span>
                <span class="talker-count">{{ formatNumber(item.count) }}</span>
              </div>
              <div class="talker-bar-track">
                <div class="talker-bar" :style="{ width: barWidth(item.count, topTalkers.topIps!) }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Top Hosts -->
        <div class="talker-card" v-if="topTalkers.topHosts?.length">
          <h3 class="talker-title" title="The websites and domains receiving the most traffic. This shows which of your properties are busiest right now.">
            <UIcon name="i-heroicons-globe-alt" class="w-4 h-4" />
            Top Hosts
          </h3>
          <div class="talker-list">
            <div v-for="item in topTalkers.topHosts" :key="item.value" class="talker-item">
              <div class="talker-info">
                <span class="talker-value">{{ item.value }}</span>
                <span class="talker-count">{{ formatNumber(item.count) }}</span>
              </div>
              <div class="talker-bar-track">
                <div class="talker-bar" :style="{ width: barWidth(item.count, topTalkers.topHosts!) }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Top Status Codes -->
        <div class="talker-card" v-if="topTalkers.topStatuses?.length">
          <h3 class="talker-title" title="HTTP response codes returned to visitors. 2xx means success, 3xx is a redirect, 4xx means the visitor requested something invalid, and 5xx indicates a server-side problem.">
            <UIcon name="i-heroicons-signal" class="w-4 h-4" />
            Top Status Codes
          </h3>
          <div class="talker-list">
            <div v-for="item in topTalkers.topStatuses" :key="item.value" class="talker-item">
              <div class="talker-info">
                <span class="talker-value">
                  <span class="status-dot" :class="'status-' + item.value.charAt(0) + 'xx'"></span>
                  {{ item.value }}
                </span>
                <span class="talker-count">{{ formatNumber(item.count) }}</span>
              </div>
              <div class="talker-bar-track">
                <div class="talker-bar" :style="{ width: barWidth(item.count, topTalkers.topStatuses!) }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Top Firewall Actions -->
        <div class="talker-card" v-if="topTalkers.topActions?.length">
          <h3 class="talker-title" title="How Cloudflare's firewall responded to incoming requests. 'Allow' means the request was permitted, 'Block' means it was stopped, and 'Challenge' means the visitor was asked to prove they are human.">
            <UIcon name="i-heroicons-shield-check" class="w-4 h-4" />
            Firewall Actions
          </h3>
          <div class="talker-list">
            <div v-for="item in topTalkers.topActions" :key="item.value" class="talker-item">
              <div class="talker-info">
                <span class="talker-value">
                  <span class="action-badge" :class="'action-' + item.value.toLowerCase()">{{ item.value }}</span>
                </span>
                <span class="talker-count">{{ formatNumber(item.count) }}</span>
              </div>
              <div class="talker-bar-track">
                <div class="talker-bar" :class="'bar-' + item.value.toLowerCase()" :style="{ width: barWidth(item.count, topTalkers.topActions!) }"></div>
              </div>
            </div>
          </div>
        </div>
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

.dataset-last-seen {
  font-size: 11px;
  color: #525252;
  margin: 2px 0 0 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.dataset-last-seen.stale {
  color: #dc2626;
}

.dataset-arrow {
  color: #525252;
  flex-shrink: 0;
}

/* Top Talkers */
.section-subtitle {
  font-size: 12px;
  font-weight: 400;
  color: #525252;
}

.talkers-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (max-width: 1200px) {
  .talkers-grid {
    grid-template-columns: 1fr;
  }
}

.talker-card {
  background-color: #141414;
  border: 1px solid #262626;
  border-radius: 8px;
  padding: 16px;
}

.talker-title {
  font-size: 13px;
  font-weight: 600;
  color: #a3a3a3;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: help;
  text-decoration: underline dotted rgba(163, 163, 163, 0.4);
  text-underline-offset: 3px;
}

.talker-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.talker-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.talker-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.talker-value {
  font-size: 13px;
  color: #d4d4d4;
  display: flex;
  align-items: center;
  gap: 6px;
}

.talker-count {
  font-size: 12px;
  color: #737373;
  font-variant-numeric: tabular-nums;
}

.talker-bar-track {
  width: 100%;
  height: 4px;
  background-color: #262626;
  border-radius: 2px;
  overflow: hidden;
}

.talker-bar {
  height: 100%;
  background-color: #f6821f;
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* Status dots */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-2xx { background-color: #22c55e; }
.status-3xx { background-color: #3b82f6; }
.status-4xx { background-color: #eab308; }
.status-5xx { background-color: #ef4444; }

/* Action badges */
.action-badge {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 4px;
}

.action-allow { background-color: rgba(34, 197, 94, 0.15); color: #22c55e; }
.action-block { background-color: rgba(239, 68, 68, 0.15); color: #ef4444; }
.action-challenge, .action-jschallenge, .action-managedchallenge { background-color: rgba(234, 179, 8, 0.15); color: #eab308; }
.action-log { background-color: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.action-skip { background-color: rgba(163, 163, 163, 0.15); color: #a3a3a3; }
.action-managedchallengebypassed { background-color: rgba(168, 85, 247, 0.15); color: #a855f7; }

/* Colored bars for firewall actions */
.bar-block { background-color: #ef4444; }
.bar-challenge, .bar-jschallenge, .bar-managedchallenge { background-color: #eab308; }
.bar-allow { background-color: #22c55e; }
.bar-log { background-color: #3b82f6; }
.bar-skip { background-color: #a3a3a3; }
.bar-managedchallengebypassed { background-color: #a855f7; }

/* Skeleton loading animations */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton-line {
  background: linear-gradient(90deg, #262626 25%, #333333 50%, #262626 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

.skeleton-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: linear-gradient(90deg, #262626 25%, #333333 50%, #262626 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  flex-shrink: 0;
}

.skeleton-icon-sm {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(90deg, #262626 25%, #333333 50%, #262626 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  flex-shrink: 0;
}

.skeleton-label {
  width: 80px;
  height: 14px;
  margin-bottom: 6px;
}

.skeleton-value {
  width: 60px;
  height: 28px;
}

.skeleton-name {
  width: 100px;
  height: 14px;
  margin-bottom: 4px;
}

.skeleton-count {
  width: 60px;
  height: 12px;
}

.skeleton-talker-title {
  width: 120px;
  height: 14px;
  margin-bottom: 12px;
}

.skeleton-talker-label {
  width: 100px;
  height: 13px;
}

.skeleton-talker-count {
  width: 36px;
  height: 12px;
}

.skeleton-bar {
  background: linear-gradient(90deg, #262626 25%, #333333 50%, #262626 75%) !important;
  background-size: 200% 100% !important;
  animation: shimmer 1.5s ease-in-out infinite;
}
</style>
