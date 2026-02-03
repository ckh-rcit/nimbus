import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Lazy initialization of database connection
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null
let _client: ReturnType<typeof postgres> | null = null

export function getDatabase() {
  if (!_db) {
    const config = useRuntimeConfig()
    
    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL is not configured')
    }

    _client = postgres(config.databaseUrl, {
      max: 10, // Connection pool size
      idle_timeout: 20,
      connect_timeout: 10
    })

    _db = drizzle(_client, { schema })
  }

  return _db
}

// Export for convenience
export { schema }

// Graceful shutdown helper
export async function closeDatabase() {
  if (_client) {
    await _client.end()
    _client = null
    _db = null
  }
}
