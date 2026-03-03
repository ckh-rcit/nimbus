import { pgTable, text, timestamp, serial, jsonb, index, varchar, integer, uniqueIndex } from 'drizzle-orm/pg-core'

// Zones table - cached from Cloudflare API
export const zones = pgTable('zones', {
  id: text('id').primaryKey(), // Cloudflare zone ID
  name: text('name').notNull(), // Zone domain name
  status: text('status').notNull(), // active, pending, etc.
  accountId: text('account_id').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('zones_account_id_idx').on(table.accountId),
  index('zones_name_idx').on(table.name)
])

// Logs table - stores all log entries with JSONB data
export const logs = pgTable('logs', {
  id: serial('id').primaryKey(),
  dataset: varchar('dataset', { length: 50 }).notNull(), // http_requests, firewall_events, etc.
  scope: varchar('scope', { length: 10 }).notNull().default('zone'), // 'zone' or 'account'
  zoneId: text('zone_id'), // For zone-scoped datasets
  accountId: text('account_id'), // For account-scoped datasets  
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(), // Log event timestamp
  rayId: text('ray_id'), // Cloudflare Ray ID for correlation
  clientIp: text('client_ip'), // Client IP for searching
  data: jsonb('data').notNull(), // Full log entry as JSONB
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('logs_dataset_idx').on(table.dataset),
  index('logs_scope_idx').on(table.scope),
  index('logs_zone_id_idx').on(table.zoneId),
  index('logs_account_id_idx').on(table.accountId),
  index('logs_timestamp_idx').on(table.timestamp),
  index('logs_ray_id_idx').on(table.rayId),
  index('logs_client_ip_idx').on(table.clientIp),
  // Composite indexes for common queries
  index('logs_dataset_timestamp_idx').on(table.dataset, table.timestamp),
  index('logs_scope_dataset_timestamp_idx').on(table.scope, table.dataset, table.timestamp),
  index('logs_dataset_zone_timestamp_idx').on(table.dataset, table.zoneId, table.timestamp)
])

// Type exports for use in application
export type Zone = typeof zones.$inferSelect
export type NewZone = typeof zones.$inferInsert
export type Log = typeof logs.$inferSelect
export type NewLog = typeof logs.$inferInsert

/**
 * Pre-aggregated stats rollup table.
 * Updated during ingest so queries read a small summary
 * instead of scanning millions of raw log rows.
 * 
 * Each row = one (hour_bucket, metric, dimension_value, zone_id) combination.
 * 
 * Tracked metrics:
 * - 'dataset': Dataset type (http_requests, firewall_events)
 * - 'host': ClientRequestHost from http_requests  
 * - 'client_ip': Client IP address from all datasets
 * - 'fw_action': Firewall action from firewall_events
 * - 'fw_mitigated_zone': Zones with non-allow actions
 * - 'http_status': EdgeResponseStatus from http_requests
 * - 'cache_status': CacheCacheStatus from http_requests
 * - 'country': ClientCountry from all datasets
 */
export const statsRollup = pgTable('stats_rollup', {
  id: serial('id').primaryKey(),
  hourBucket: timestamp('hour_bucket', { withTimezone: true }).notNull(), // Truncated to the hour
  metric: varchar('metric', { length: 30 }).notNull(),   // 'host' | 'client_ip' | 'fw_action' | 'fw_mitigated_zone'
  dimensionValue: text('dimension_value').notNull(),       // The grouped value (e.g. IP, hostname, action name)
  zoneId: text('zone_id').notNull().default('__all__'),    // Zone ID or '__all__' for cross-zone
  count: integer('count').notNull().default(0)
}, (table) => [
  // Fast lookups: metric + time range, optionally filtered by zone
  uniqueIndex('stats_rollup_uq').on(table.hourBucket, table.metric, table.dimensionValue, table.zoneId),
  index('stats_rollup_metric_hour_idx').on(table.metric, table.hourBucket),
  index('stats_rollup_zone_metric_hour_idx').on(table.zoneId, table.metric, table.hourBucket)
])

export type StatsRollup = typeof statsRollup.$inferSelect
export type NewStatsRollup = typeof statsRollup.$inferInsert
