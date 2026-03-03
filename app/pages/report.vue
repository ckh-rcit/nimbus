<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

// Fetch zones for dropdown
const { data: zonesData } = await useFetch('/api/zones')
const zones = computed(() => zonesData.value?.zones || [])

// Local state for report parameters (independent from global navigation)
const reportZone = ref<string | null>(null)
const reportTimeRange = ref('24h')

// Time range options
const timeRangeOptions = [
  { label: 'Last Hour', value: '1h' },
  { label: 'Last 6 Hours', value: '6h' },
  { label: 'Last 24 Hours', value: '24h' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' }
]

// Convert time range to hours
const hoursMap: Record<string, number> = {
  '1h': 1,
  '6h': 6,
  '24h': 24,
  '7d': 168,
  '30d': 720
}

const reportQuery = computed(() => {
  const params: Record<string, string> = {
    hours: String(Math.floor(hoursMap[reportTimeRange.value] || 24))
  }
  if (reportZone.value) {
    params.zoneId = reportZone.value
  }
  return params
})

// Fetch report data (lazy - only when user clicks Generate)
const { data: report, pending, execute } = useLazyFetch('/api/report', {
  query: reportQuery,
  immediate: false
})

// Generate report handler
const handleGenerate = () => {
  execute()
}

// Get selected zone name for display
const reportZoneName = computed(() => {
  if (!reportZone.value) return 'All Zones'
  const zone = zones.value.find((z: any) => z.id === reportZone.value)
  return zone?.name || 'Unknown Zone'
})

// Time range label for display
const reportTimeRangeLabel = computed(() => {
  const option = timeRangeOptions.find(opt => opt.value === reportTimeRange.value)
  return option?.label || 'Last 24 Hours'
})

// Format numbers
const formatNumber = (n: number) => new Intl.NumberFormat().format(n)
const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short'
})

// Country code to full name mapping (ISO 3166-1 alpha-2)
const countryNames: Record<string, string> = {
  'US': 'United States', 'GB': 'United Kingdom', 'CA': 'Canada', 'AU': 'Australia',
  'DE': 'Germany', 'FR': 'France', 'IT': 'Italy', 'ES': 'Spain', 'NL': 'Netherlands',
  'BE': 'Belgium', 'CH': 'Switzerland', 'AT': 'Austria', 'SE': 'Sweden', 'NO': 'Norway',
  'DK': 'Denmark', 'FI': 'Finland', 'IE': 'Ireland', 'PT': 'Portugal', 'GR': 'Greece',
  'PL': 'Poland', 'CZ': 'Czech Republic', 'HU': 'Hungary', 'RO': 'Romania', 'BG': 'Bulgaria',
  'CN': 'China', 'JP': 'Japan', 'KR': 'South Korea', 'IN': 'India', 'SG': 'Singapore',
  'HK': 'Hong Kong', 'TW': 'Taiwan', 'TH': 'Thailand', 'MY': 'Malaysia', 'ID': 'Indonesia',
  'PH': 'Philippines', 'VN': 'Vietnam', 'NZ': 'New Zealand', 'BR': 'Brazil', 'MX': 'Mexico',
  'AR': 'Argentina', 'CL': 'Chile', 'CO': 'Colombia', 'PE': 'Peru', 'VE': 'Venezuela',
  'ZA': 'South Africa', 'EG': 'Egypt', 'NG': 'Nigeria', 'KE': 'Kenya', 'MA': 'Morocco',
  'AE': 'United Arab Emirates', 'SA': 'Saudi Arabia', 'IL': 'Israel', 'TR': 'Turkey',
  'RU': 'Russia', 'UA': 'Ukraine', 'BY': 'Belarus', 'KZ': 'Kazakhstan', 'UZ': 'Uzbekistan',
  'PK': 'Pakistan', 'BD': 'Bangladesh', 'LK': 'Sri Lanka', 'NP': 'Nepal', 'MM': 'Myanmar',
  'KH': 'Cambodia', 'LA': 'Laos', 'BN': 'Brunei', 'MO': 'Macau', 'MV': 'Maldives',
  'AF': 'Afghanistan', 'IQ': 'Iraq', 'IR': 'Iran', 'JO': 'Jordan', 'LB': 'Lebanon',
  'SY': 'Syria', 'YE': 'Yemen', 'OM': 'Oman', 'KW': 'Kuwait', 'BH': 'Bahrain',
  'QA': 'Qatar', 'AM': 'Armenia', 'AZ': 'Azerbaijan', 'GE': 'Georgia', 'TM': 'Turkmenistan',
  'TJ': 'Tajikistan', 'KG': 'Kyrgyzstan', 'MN': 'Mongolia', 'BT': 'Bhutan', 'FJ': 'Fiji',
  'PG': 'Papua New Guinea', 'NC': 'New Caledonia', 'PF': 'French Polynesia', 'WS': 'Samoa',
  'SB': 'Solomon Islands', 'VU': 'Vanuatu', 'TO': 'Tonga', 'KI': 'Kiribati', 'TV': 'Tuvalu',
  'IS': 'Iceland', 'LU': 'Luxembourg', 'MT': 'Malta', 'CY': 'Cyprus', 'EE': 'Estonia',
  'LV': 'Latvia', 'LT': 'Lithuania', 'SI': 'Slovenia', 'SK': 'Slovakia', 'HR': 'Croatia',
  'BA': 'Bosnia and Herzegovina', 'RS': 'Serbia', 'ME': 'Montenegro', 'MK': 'North Macedonia',
  'AL': 'Albania', 'XK': 'Kosovo', 'MD': 'Moldova', 'AD': 'Andorra', 'MC': 'Monaco',
  'SM': 'San Marino', 'VA': 'Vatican City', 'LI': 'Liechtenstein', 'GI': 'Gibraltar',
  'FO': 'Faroe Islands', 'IM': 'Isle of Man', 'JE': 'Jersey', 'GG': 'Guernsey', 'AX': 'Åland Islands'
}

const formatCountry = (code: string | null | undefined): string => {
  if (!code || code === 'Unknown') return 'Unknown'
  return countryNames[code.toUpperCase()] || code
}

// Print handler
const handlePrint = () => {
  window.print()
}

// Export as PDF would just use browser print to PDF
</script>

<template>
  <div class="report-container">
    <!-- Screen-only controls -->
    <div class="report-controls no-print">
      <h1 class="report-page-title">Executive Report</h1>
      <div class="report-filters">
        <div class="filter-group">
          <label class="filter-label">Zone</label>
          <div class="select-wrapper">
            <select v-model="reportZone" class="filter-select">
              <option :value="null">All Zones Report</option>
              <option v-for="zone in zones" :key="zone.id" :value="zone.id">
                {{ zone.name }} Report
              </option>
            </select>
            <UIcon name="i-heroicons-chevron-down" class="select-icon" />
          </div>
        </div>
        <div class="filter-group">
          <label class="filter-label">Time Range</label>
          <div class="select-wrapper">
            <select v-model="reportTimeRange" class="filter-select">
              <option v-for="option in timeRangeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <UIcon name="i-heroicons-chevron-down" class="select-icon" />
          </div>
        </div>
        <button @click="handleGenerate" class="refresh-btn" :disabled="pending">
          <UIcon name="i-heroicons-arrow-path" class="w-4 h-4" :class="{ 'animate-spin': pending }" />
          <span>Generate</span>
        </button>
      </div>
      <div class="print-actions">
        <button @click="handlePrint" class="print-btn" :disabled="pending || !report">
          <UIcon name="i-heroicons-printer" class="w-4 h-4" />
          <span>Print / Export PDF</span>
        </button>
        <p v-if="report" class="print-tip">
          💡 For best results, enable "Background graphics" in print settings
        </p>
      </div>
    </div>

    <!-- Print-friendly report -->
    <div v-if="!pending && report" class="report-document">
      <!-- Header -->
      <div class="report-header">
        <div class="report-logo">
          <div class="report-logo-icon">
            <UIcon name="i-heroicons-cloud" class="w-6 h-6 text-white" />
          </div>
          <h1 class="report-title">NIMBUS</h1>
        </div>
        <div class="report-meta">
          <h2 class="report-subtitle">Security & Traffic Report</h2>
          <p class="report-period">{{ reportTimeRangeLabel }}</p>
          <p class="report-zone">{{ reportZoneName }}</p>
          <p class="report-generated">Generated: {{ formatDate(report.generatedAt) }}</p>
        </div>
      </div>

      <!-- Executive Summary -->
      <section class="report-section">
        <h3 class="section-title">Executive Summary</h3>
        <div class="summary-grid">
          <div class="metric-card primary">
            <div class="metric-value">{{ formatNumber(report.overview.totalRequests) }}</div>
            <div class="metric-label">Total Requests</div>
          </div>
          <div class="metric-card success">
            <div class="metric-value">{{ formatNumber(report.overview.blockedRequests) }}</div>
            <div class="metric-label">Threats Blocked</div>
          </div>
          <div class="metric-card warning">
            <div class="metric-value">{{ report.overview.blockRate }}%</div>
            <div class="metric-label">Block Rate</div>
          </div>
          <div class="metric-card info">
            <div class="metric-value">{{ report.performance.cacheHitRate }}%</div>
            <div class="metric-label">Cache Hit Rate</div>
          </div>
        </div>
      </section>

      <!-- Security Overview -->
      <section class="report-section">
        <h3 class="section-title">Security Overview</h3>
        <p class="section-description">
          Cloudflare's security layer processed <strong>{{ formatNumber(report.overview.firewallEvents) }}</strong> security events,
          blocking <strong>{{ formatNumber(report.overview.blockedRequests) }}</strong> malicious requests
          and issuing <strong>{{ formatNumber(report.overview.challengedRequests) }}</strong> challenges to verify legitimate traffic.
        </p>
        
        <div class="two-column">
          <div class="chart-card">
            <h4 class="chart-title">Firewall Action Breakdown</h4>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th class="text-right">Count</th>
                  <th class="text-right">%</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="action in report.firewallActions.slice(0, 5)" :key="action.action">
                  <td class="capitalize">{{ action.action }}</td>
                  <td class="text-right">{{ formatNumber(action.count) }}</td>
                  <td class="text-right">{{ action.percent }}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="chart-card">
            <h4 class="chart-title">Top Blocked Threat Sources</h4>
            <table class="data-table">
              <thead>
                <tr>
                  <th>IP Address</th>
                  <th>Country</th>
                  <th class="text-right">Blocks</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="threat in report.topThreats.slice(0, 5)" :key="threat.ip">
                  <td class="font-mono text-sm">{{ threat.ip }}</td>
                  <td>{{ formatCountry(threat.country) }}</td>
                  <td class="text-right">{{ formatNumber(threat.count) }}</td>
                </tr>
                <tr v-if="report.topThreats.length === 0">
                  <td colspan="3" class="text-center text-muted">No blocked threats in this period</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Traffic Analysis -->
      <section class="report-section">
        <h3 class="section-title">Traffic Analysis</h3>
        
        <div class="two-column">
          <div class="chart-card">
            <h4 class="chart-title">Geographic Distribution</h4>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Country</th>
                  <th class="text-right">Requests</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="country in report.topCountries.slice(0, 8)" :key="country.country">
                  <td>{{ formatCountry(country.country) }}</td>
                  <td class="text-right">{{ formatNumber(country.count) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="chart-card">
            <h4 class="chart-title">Most Active Hosts</h4>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Hostname</th>
                  <th class="text-right">Requests</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="host in report.topHosts.slice(0, 8)" :key="host.host">
                  <td class="truncate">{{ host.host }}</td>
                  <td class="text-right">{{ formatNumber(host.count) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="report.topZones.length > 0" class="chart-card">
          <h4 class="chart-title">Traffic by Zone</h4>
          <table class="data-table">
            <thead>
              <tr>
                <th>Zone</th>
                <th class="text-right">Total Requests</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="zone in report.topZones" :key="zone.zoneId">
                <td>{{ zone.zoneName }}</td>
                <td class="text-right">{{ formatNumber(zone.count) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Performance Metrics -->
      <section class="report-section">
        <h3 class="section-title">Performance Metrics</h3>
        
        <div class="summary-grid small">
          <div class="metric-card">
            <div class="metric-value">{{ report.performance.successRate }}%</div>
            <div class="metric-label">Success Rate (2xx)</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">{{ report.performance.cacheHitRate }}%</div>
            <div class="metric-label">Cache Hit Rate</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">{{ report.performance.clientErrorRate }}%</div>
            <div class="metric-label">Client Errors (4xx)</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">{{ report.performance.serverErrorRate }}%</div>
            <div class="metric-label">Server Errors (5xx)</div>
          </div>
        </div>
      </section>

      <!-- Footer / Watermark -->
      <div class="report-footer">
        <div class="watermark">Generated by NIMBUS</div>
        <div class="footer-info">
          <p>Report Period: {{ formatDate(report.period.start) }} to {{ formatDate(report.period.end) }}</p>
          <p class="confidential">CONFIDENTIAL - For Internal Use Only</p>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-else-if="pending" class="loading-state">
      <div class="loading-spinner">
        <UIcon name="i-heroicons-arrow-path" class="w-12 h-12 animate-spin text-orange-500" />
      </div>
      <h2 class="loading-title">Generating Executive Report</h2>
      <p class="loading-text">Analyzing security metrics, traffic patterns, and performance data...</p>
      <div class="loading-steps">
        <div class="loading-step">
          <UIcon name="i-heroicons-check-circle" class="w-4 h-4 text-green-500" />
          <span>Collecting firewall statistics</span>
        </div>
        <div class="loading-step">
          <UIcon name="i-heroicons-check-circle" class="w-4 h-4 text-green-500" />
          <span>Processing traffic data</span>
        </div>
        <div class="loading-step">
          <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin text-orange-500" />
          <span>Compiling report sections</span>
        </div>
      </div>
    </div>

    <!-- Empty state - no report generated yet -->
    <div v-else class="empty-state">
      <div class="empty-icon">
        <UIcon name="i-heroicons-document-chart-bar" class="w-16 h-16 text-neutral-600" />
      </div>
      <h2 class="empty-title">Ready to Generate Your Report</h2>
      <p class="empty-text">
        Select a zone and time range above, then click <strong>Generate</strong> to create 
        a comprehensive security and traffic report for upper management.
      </p>
      <div class="empty-features">
        <div class="empty-feature">
          <UIcon name="i-heroicons-shield-check" class="w-5 h-5 text-green-500" />
          <span>Security metrics & threat analysis</span>
        </div>
        <div class="empty-feature">
          <UIcon name="i-heroicons-globe-alt" class="w-5 h-5 text-blue-500" />
          <span>Traffic patterns & geographic data</span>
        </div>
        <div class="empty-feature">
          <UIcon name="i-heroicons-chart-bar" class="w-5 h-5 text-orange-500" />
          <span>Performance insights & statistics</span>
        </div>
        <div class="empty-feature">
          <UIcon name="i-heroicons-printer" class="w-5 h-5 text-purple-500" />
          <span>Print-ready professional format</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.report-container {
  min-height: calc(100vh - 200px);
}

.report-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #262626;
}

.report-page-title {
  font-size: 24px;
  font-weight: 600;
  color: #fafafa;
  flex: 1 1 100%;
  margin-bottom: 8px;
}

.report-filters {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex: 1;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-label {
  font-size: 12px;
  font-weight: 500;
  color: #a3a3a3;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.select-wrapper {
  position: relative;
}

.filter-select {
  appearance: none;
  background-color: #171717;
  border: 1px solid #262626;
  border-radius: 6px;
  padding: 8px 32px 8px 12px;
  font-size: 14px;
  color: #fafafa;
  min-width: 200px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-select:focus {
  outline: none;
  border-color: #f6821f;
  box-shadow: 0 0 0 1px #f6821f;
}

.select-icon {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: #737373;
  pointer-events: none;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  color: #fafafa;
  background-color: #262626;
  border: 1px solid #404040;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  height: 38px;
}

.refresh-btn:hover:not(:disabled) {
  background-color: #2a2a2a;
  border-color: #525252;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.print-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  background-color: #f6821f;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.print-btn:hover {
  background-color: #e5720d;
}

.print-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: #666;
}

.print-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.print-tip {
  font-size: 12px;
  color: #a3a3a3;
  margin: 0;
  font-style: italic;
}

/* Report Document */
.report-document {
  background: white;
  color: #1a1a1a;
  padding: 48px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  max-width: 1200px;
  margin: 0 auto;
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 24px;
  margin-bottom: 32px;
  border-bottom: 3px solid #f6821f;
}

.report-logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.report-logo-icon {
  width: 48px;
  height: 48px;
  background-color: #f6821f;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.report-title {
  font-size: 32px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -0.025em;
}

.report-meta {
  text-align: right;
}

.report-subtitle {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
}

.report-period {
  font-size: 14px;
  color: #666;
  margin-bottom: 4px;
}

.report-zone {
  font-size: 14px;
  font-weight: 600;
  color: #f6821f;
  margin-bottom: 8px;
}

.report-generated {
  font-size: 12px;
  color: #999;
}

/* Sections */
.report-section {
  margin-bottom: 40px;
  page-break-inside: avoid;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e5e5e5;
}

.section-description {
  font-size: 14px;
  line-height: 1.6;
  color: #666;
  margin-bottom: 24px;
}

.section-description strong {
  color: #1a1a1a;
  font-weight: 600;
}

/* Metrics Grid */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.summary-grid.small {
  margin-bottom: 0;
}

.metric-card {
  background: #f8f8f8;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}

.metric-card.primary {
  background: #eff6ff;
  border-color: #3b82f6;
}

.metric-card.success {
  background: #f0fdf4;
  border-color: #22c55e;
}

.metric-card.warning {
  background: #fef3c7;
  border-color: #f59e0b;
}

.metric-card.info {
  background: #fef9ee;
  border-color: #f6821f;
}

.metric-value {
  font-size: 32px;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 8px;
  line-height: 1;
}

.metric-label {
  font-size: 13px;
  font-weight: 500;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Two Column Layout */
.two-column {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.chart-card {
  background: #f8f8f8;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 20px;
  page-break-inside: avoid;
}

.chart-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 16px;
}

/* Tables */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table thead {
  border-bottom: 2px solid #e5e5e5;
}

.data-table th {
  padding: 8px;
  text-align: left;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.05em;
}

.data-table td {
  padding: 10px 8px;
  border-bottom: 1px solid #f0f0f0;
  color: #1a1a1a;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.text-right {
  text-align: right;
}

.text-center {
  text-align: center;
}

.text-muted {
  color: #999;
  font-style: italic;
}

.capitalize {
  text-transform: capitalize;
}

.font-mono {
  font-family: 'Courier New', monospace;
}

.text-sm {
  font-size: 12px;
}

.truncate {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Footer */
.report-footer {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 2px solid #e5e5e5;
  text-align: center;
}

.watermark {
  font-size: 24px;
  font-weight: 700;
  color: #f6821f;
  opacity: 0.3;
  letter-spacing: 0.2em;
  margin-bottom: 16px;
}

.footer-info {
  font-size: 12px;
  color: #999;
}

.footer-info p {
  margin: 4px 0;
}

.confidential {
  font-weight: 600;
  color: #666;
  margin-top: 8px;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 500px;
  gap: 24px;
  padding: 48px;
  background: linear-gradient(135deg, rgba(246, 130, 31, 0.05) 0%, rgba(246, 130, 31, 0.02) 100%);
  border-radius: 12px;
  border: 1px solid #262626;
}

.loading-spinner {
  margin-bottom: 8px;
}

.loading-title {
  font-size: 24px;
  font-weight: 600;
  color: #fafafa;
  margin: 0;
}

.loading-text {
  font-size: 14px;
  color: #a3a3a3;
  margin: 0;
  max-width: 400px;
  text-align: center;
}

.loading-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
  padding: 20px 24px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  border: 1px solid #262626;
}

.loading-step {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #d4d4d4;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 500px;
  gap: 24px;
  padding: 48px;
  background: linear-gradient(135deg, rgba(23, 23, 23, 0.5) 0%, rgba(10, 10, 10, 0.2) 100%);
  border-radius: 12px;
  border: 2px dashed #262626;
}

.empty-icon {
  margin-bottom: 8px;
}

.empty-title {
  font-size: 28px;
  font-weight: 600;
  color: #fafafa;
  margin: 0;
}

.empty-text {
  font-size: 15px;
  color: #a3a3a3;
  margin: 0;
  max-width: 500px;
  text-align: center;
  line-height: 1.6;
}

.empty-text strong {
  color: #f6821f;
  font-weight: 600;
}

.empty-features {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 16px;
  padding: 24px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  border: 1px solid #262626;
}

.empty-feature {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #d4d4d4;
}

/* Print Styles */
@media print {
  /* Hide non-printable elements */
  .no-print {
    display: none !important;
  }

  /* Reset page and container */
  @page {
    margin: 0.75in;
    size: letter;
  }

  body {
    background: white;
  }

  .report-container {
    background: white;
    min-height: auto;
  }

  .report-document {
    box-shadow: none;
    padding: 0;
    max-width: none;
    background: white;
    border-radius: 0;
    margin: 0;
  }

  /* Header stays together */
  .report-header {
    page-break-after: avoid;
    margin-bottom: 24px;
    padding-bottom: 16px;
  }

  /* Prevent awkward breaks */
  .report-section {
    page-break-inside: avoid;
    margin-bottom: 32px;
  }

  .section-title {
    page-break-after: avoid;
    margin-bottom: 12px;
  }

  .chart-card {
    page-break-inside: avoid;
    margin-bottom: 16px;
  }

  .metric-card {
    page-break-inside: avoid;
  }

  .summary-grid {
    page-break-inside: avoid;
    margin-bottom: 20px;
  }

  .two-column {
    page-break-inside: avoid;
    margin-bottom: 20px;
  }

  /* Ensure all colors and backgrounds print */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }

  .metric-card.primary,
  .metric-card.success,
  .metric-card.warning,
  .metric-card.info {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .report-logo-icon {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Ensure borders print */
  .metric-card,
  .chart-card,
  .data-table,
  .data-table th,
  .data-table td {
    border-color: #e5e5e5 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Make sure backgrounds print in metric cards */
  .metric-card.primary {
    background: #eff6ff !important;
    border: 1px solid #3b82f6 !important;
  }

  .metric-card.success {
    background: #f0fdf4 !important;
    border: 1px solid #22c55e !important;
  }

  .metric-card.warning {
    background: #fef3c7 !important;
    border: 1px solid #f59e0b !important;
  }

  .metric-card.info {
    background: #fef9ee !important;
    border: 1px solid #f6821f !important;
  }

  /* Ensure chart cards have backgrounds */
  .chart-card {
    background: #f8f8f8 !important;
    border: 1px solid #e5e5e5 !important;
  }

  /* Footer watermark */
  .watermark {
    opacity: 0.2 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Optimize table printing */
  .data-table {
    border-collapse: collapse;
  }

  .data-table thead {
    border-bottom: 2px solid #e5e5e5;
  }

  .data-table td {
    border-bottom: 1px solid #f0f0f0;
  }

  /* Font adjustments for print */
  body,
  .report-document {
    font-size: 11pt;
    line-height: 1.4;
  }

  .report-title {
    font-size: 28pt;
  }

  .report-subtitle {
    font-size: 18pt;
  }

  .section-title {
    font-size: 16pt;
  }

  .chart-title {
    font-size: 13pt;
  }

  .metric-value {
    font-size: 26pt;
  }

  .metric-label {
    font-size: 10pt;
  }

  /* Ensure proper spacing */
  .report-header {
    margin-bottom: 1.5em;
  }

  .report-section {
    margin-bottom: 2em;
  }

  .summary-grid {
    gap: 12px;
  }

  .two-column {
    gap: 16px;
  }
}

/* Responsive */
@media (max-width: 1024px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .two-column {
    grid-template-columns: 1fr;
  }

  .report-filters {
    flex-wrap: wrap;
  }

  .filter-select {
    min-width: 160px;
  }
}

@media (max-width: 640px) {
  .report-document {
    padding: 24px;
  }

  .report-header {
    flex-direction: column;
    gap: 16px;
  }

  .report-meta {
    text-align: left;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }

  .metric-value {
    font-size: 24px;
  }

  .report-filters {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
  }

  .filter-group {
    width: 100%;
  }

  .filter-select {
    width: 100%;
  }

  .refresh-btn,
  .print-btn {
    width: 100%;
    justify-content: center;
  }

  .print-actions {
    width: 100%;
    align-items: center;
  }

  .print-tip {
    text-align: center;
  }

  .empty-features {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .empty-title {
    font-size: 22px;
  }
}
</style>
