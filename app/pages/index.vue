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

// Cache TTL: return cached data if fresher than 30s, avoiding re-fetches on navigation
const CACHE_MAX_AGE = 30_000
const cacheTimestamps = new Map<string, number>()

function getCachedData(key: string, nuxtApp: any) {
  const cached = nuxtApp.payload.data[key] || nuxtApp.static.data[key]
  if (!cached) return undefined
  const fetchedAt = cacheTimestamps.get(key) || 0
  if (Date.now() - fetchedAt > CACHE_MAX_AGE) return undefined
  return cached
}

// Use lazy fetches with server:false so the page renders instantly with skeletons
// getCachedData returns stale data on back-navigation so there's no loading flash
const { data: stats, status: statsStatus } = useLazyFetch('/api/stats', {
  key: 'dashboard-stats',
  query: statsQuery,
  watch: [statsQuery],
  server: false,
  getCachedData: (key, nuxtApp) => getCachedData(key, nuxtApp),
  onResponse() { cacheTimestamps.set('dashboard-stats', Date.now()) }
})
const { data: zonesData } = useLazyFetch('/api/zones', {
  key: 'dashboard-zones',
  server: false,
  getCachedData: (key, nuxtApp) => getCachedData(key, nuxtApp),
  onResponse() { cacheTimestamps.set('dashboard-zones', Date.now()) }
})

const { data: topTalkers, status: talkersStatus } = useLazyFetch('/api/stats/top-talkers', {
  key: 'dashboard-top-talkers',
  query: statsQuery,
  watch: [statsQuery],
  server: false,
  getCachedData: (key, nuxtApp) => getCachedData(key, nuxtApp),
  onResponse() { cacheTimestamps.set('dashboard-top-talkers', Date.now()) }
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

// Percentage width for firewall actions
function percentWidth(percent: number): string {
  return `${Math.max(percent, 2)}%`
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
      <div class="talkers-grid" v-else-if="topTalkers && (topTalkers.topHosts?.length || topTalkers.topIps?.length || topTalkers.firewallActions?.length || topTalkers.mostTargeted?.length)">
        <!-- Top Hosts -->
        <div class="talker-card" v-if="topTalkers.topHosts?.length">
          <h3 class="talker-title has-tooltip">
            <UIcon name="i-heroicons-globe-alt" class="w-4 h-4" />
            Top Hosts
            <UIcon name="i-heroicons-information-circle" class="w-3.5 h-3.5 tooltip-icon" />
            <span class="custom-tooltip">The websites and domains receiving the most traffic. This shows which of your properties are busiest right now.</span>
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

        <!-- Firewall Actions % -->
        <div class="talker-card" v-if="topTalkers.firewallActions?.length">
          <h3 class="talker-title has-tooltip">
            <UIcon name="i-heroicons-shield-check" class="w-4 h-4" />
            Firewall Actions
            <span class="fw-total" v-if="topTalkers.firewallTotal">({{ formatNumber(topTalkers.firewallTotal) }} total)</span>
            <UIcon name="i-heroicons-information-circle" class="w-3.5 h-3.5 tooltip-icon" />
            <span class="custom-tooltip">Breakdown of how Cloudflare's firewall responded to requests. Shows the percentage share of each action type. Click an action to view those logs.</span>
          </h3>
          <div class="talker-list">
            <NuxtLink
              v-for="item in topTalkers.firewallActions"
              :key="item.value"
              :to="{ path: '/logs/firewall_events', query: { 'filter.data.Action': item.value } }"
              class="talker-item talker-item-link"
            >
              <div class="talker-info">
                <span class="talker-value">
                  <span class="action-badge" :class="'action-' + item.value.toLowerCase()">{{ item.value }}</span>
                </span>
                <span class="talker-count">{{ item.percent }}%</span>
              </div>
              <div class="talker-bar-track">
                <div class="talker-bar" :class="'bar-' + item.value.toLowerCase()" :style="{ width: percentWidth(item.percent) }"></div>
              </div>
            </NuxtLink>
          </div>
        </div>

        <!-- Top Incoming IPs -->
        <div class="talker-card" v-if="topTalkers.topIps?.length">
          <h3 class="talker-title has-tooltip">
            <UIcon name="i-heroicons-signal" class="w-4 h-4" />
            Top Incoming IPs
            <UIcon name="i-heroicons-information-circle" class="w-3.5 h-3.5 tooltip-icon" />
            <span class="custom-tooltip">IP addresses generating the most requests across your zones. A single IP with unusually high traffic may indicate a bot, scraper, or potential attack.</span>
          </h3>
          <div class="talker-list">
            <div v-for="item in topTalkers.topIps" :key="item.value" class="talker-item">
              <div class="talker-info">
                <span class="talker-value font-mono" :title="[item.org, item.asn, item.country].filter(Boolean).join(' · ') || undefined">
                  {{ item.value }}
                  <span v-if="item.org" class="ip-org">{{ item.org }}</span>
                </span>
                <span class="talker-count">{{ formatNumber(item.count) }}</span>
              </div>
              <div class="talker-bar-track">
                <div class="talker-bar" :style="{ width: barWidth(item.count, topTalkers.topIps!) }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Most Targeted Zones -->
        <div class="talker-card" v-if="topTalkers.mostTargeted?.length">
          <h3 class="talker-title has-tooltip">
            <UIcon name="i-heroicons-shield-exclamation" class="w-4 h-4" />
            Most Targeted
            <UIcon name="i-heroicons-information-circle" class="w-3.5 h-3.5 tooltip-icon" />
            <span class="custom-tooltip">Zones with the most mitigated firewall events (blocks, challenges, etc). These are the sites receiving the most malicious or suspicious traffic.</span>
          </h3>
          <div class="talker-list">
            <div v-for="item in topTalkers.mostTargeted" :key="item.zoneId" class="talker-item">
              <div class="talker-info">
                <span class="talker-value">{{ item.zoneName }}</span>
                <span class="talker-count">{{ formatNumber(item.count) }} mitigated</span>
              </div>
              <div class="talker-bar-track">
                <div class="talker-bar bar-targeted" :style="{ width: barWidth(item.count, topTalkers.mostTargeted!) }"></div>
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
  position: relative;
}

/* Tooltip trigger icon */
.tooltip-icon {
  color: #525252;
  cursor: help;
  transition: color 0.15s ease;
  flex-shrink: 0;
}

.has-tooltip:hover .tooltip-icon {
  color: #f6821f;
}

/* Custom tooltip bubble */
.custom-tooltip {
  display: none;
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 50;
  width: 260px;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
  color: #d4d4d4;
  background-color: #1c1c1c;
  border: 1px solid #333333;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  pointer-events: none;
  text-decoration: none;
}

.custom-tooltip::before {
  content: '';
  position: absolute;
  top: -5px;
  left: 16px;
  width: 8px;
  height: 8px;
  background-color: #1c1c1c;
  border-left: 1px solid #333333;
  border-top: 1px solid #333333;
  transform: rotate(45deg);
}

.has-tooltip:hover .custom-tooltip {
  display: block;
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

.talker-item-link {
  text-decoration: none;
  border-radius: 6px;
  padding: 4px 6px;
  margin: -4px -6px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.talker-item-link:hover {
  background-color: #1f1f1f;
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
  min-width: 0;
}

.ip-org {
  font-family: inherit;
  font-size: 11px;
  color: #737373;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

/* Firewall total count label */
.fw-total {
  font-size: 11px;
  font-weight: 400;
  color: #525252;
  margin-left: 2px;
}

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

/* Most targeted zones bar */
.bar-targeted { background-color: #ef4444; }

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
