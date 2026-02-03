import { pgTable, text, timestamp, serial, jsonb, index, varchar } from 'drizzle-orm/pg-core'

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
  dataset: varchar('dataset', { length: 50 }).notNull(), // http_requests, dns_logs, etc.
  zoneId: text('zone_id'), // For zone-scoped datasets
  accountId: text('account_id'), // For account-scoped datasets  
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(), // Log event timestamp
  rayId: text('ray_id'), // Cloudflare Ray ID for correlation
  clientIp: text('client_ip'), // Client IP for searching
  data: jsonb('data').notNull(), // Full log entry as JSONB
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index('logs_dataset_idx').on(table.dataset),
  index('logs_zone_id_idx').on(table.zoneId),
  index('logs_account_id_idx').on(table.accountId),
  index('logs_timestamp_idx').on(table.timestamp),
  index('logs_ray_id_idx').on(table.rayId),
  index('logs_client_ip_idx').on(table.clientIp),
  // Composite index for common queries
  index('logs_dataset_timestamp_idx').on(table.dataset, table.timestamp),
  index('logs_dataset_zone_timestamp_idx').on(table.dataset, table.zoneId, table.timestamp)
])

// Type exports for use in application
export type Zone = typeof zones.$inferSelect
export type NewZone = typeof zones.$inferInsert
export type Log = typeof logs.$inferSelect
export type NewLog = typeof logs.$inferInsert
