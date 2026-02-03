<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

// Fetch stats
const { data: stats } = await useFetch('/api/stats')
const { data: zonesData } = await useFetch('/api/zones')

const formatNumber = (n: number) => new Intl.NumberFormat().format(n)

// Dataset cards with counts
const datasetCards = computed(() => {
  const counts = stats.value?.datasetCounts || {}
  return [
    { label: 'HTTP Requests', dataset: 'http_requests', icon: 'i-heroicons-globe-alt', count: counts['http_requests'] || 0 },
    { label: 'Firewall Events', dataset: 'firewall_events', icon: 'i-heroicons-shield-check', count: counts['firewall_events'] || 0 },
    { label: 'DNS Logs', dataset: 'dns_logs', icon: 'i-heroicons-server', count: counts['dns_logs'] || 0 },
    { label: 'Audit Logs', dataset: 'audit_logs', icon: 'i-heroicons-clipboard-document-list', count: counts['audit_logs'] || 0 }
  ]
})
</script>

<template>
  <div class="dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <h1 class="dashboard-title">Dashboard</h1>
      <p class="dashboard-subtitle">Cloudflare Logpush monitoring and analytics</p>
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
        <div class="stat-icon">
          <UIcon name="i-heroicons-signal" class="w-6 h-6" />
        </div>
        <div class="stat-content">
          <p class="stat-label">Status</p>
          <p class="stat-value stat-value-orange">Healthy</p>
        </div>
      </div>
    </div>

    <!-- Dataset Overview -->
    <div class="section">
      <h2 class="section-title">Datasets</h2>
      <div class="dataset-grid">
        <NuxtLink
          v-for="card in datasetCards"
          :key="card.dataset"
          :to="`/logs/${card.dataset}`"
          class="dataset-card"
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

    <!-- Quick Actions -->
    <div class="section">
      <h2 class="section-title">Quick Actions</h2>
      <div class="actions-grid">
        <div class="action-card">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 action-icon" />
          <p class="action-text">Configure Logpush jobs in the Cloudflare dashboard to start receiving logs</p>
        </div>
        <div class="action-card">
          <UIcon name="i-heroicons-link" class="w-8 h-8 action-icon" />
          <code class="action-code">/api/ingest/{dataset}</code>
          <p class="action-hint">Logpush HTTP destination endpoint</p>
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

/* Actions Grid */
.actions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (max-width: 768px) {
  .actions-grid {
    grid-template-columns: 1fr;
  }
}

.action-card {
  background-color: #141414;
  border: 1px solid #262626;
  border-radius: 8px;
  padding: 24px;
  text-align: center;
}

.action-icon {
  color: #525252;
  margin: 0 auto 12px auto;
}

.action-text {
  font-size: 13px;
  color: #737373;
  margin: 0;
  line-height: 1.5;
}

.action-code {
  display: block;
  font-size: 13px;
  color: #a3a3a3;
  background-color: #262626;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  word-break: break-all;
}

.action-hint {
  font-size: 12px;
  color: #525252;
  margin: 0;
}

.action-link {
  font-size: 14px;
  font-weight: 500;
  color: #f6821f;
  text-decoration: none;
  transition: color 0.15s ease;
}

.action-link:hover {
  color: #ff9f4a;
}
</style>
