/**
 * Simple in-memory cache with TTL for expensive analytics queries.
 * Prevents repeated heavy aggregation queries from hitting the database
 * when multiple users or auto-refresh hit the same endpoint.
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
  refreshingPromise?: Promise<T>
}

const store = new Map<string, CacheEntry<any>>()

/**
 * Get or compute a cached value. If the cache is stale, only ONE caller
 * runs the expensive computation — others wait on the same promise
 * (stampede protection).
 * 
 * @param key - Unique cache key
 * @param ttlMs - Time-to-live in milliseconds
 * @param compute - Async function to compute the value
 */
export async function cachedQuery<T>(
  key: string,
  ttlMs: number,
  compute: () => Promise<T>
): Promise<T> {
  const now = Date.now()
  const entry = store.get(key)

  // Cache hit — still fresh
  if (entry && entry.expiresAt > now) {
    return entry.data
  }

  // Cache miss or stale — but another caller is already refreshing
  if (entry?.refreshingPromise) {
    return entry.refreshingPromise
  }

  // We're the first caller to refresh — run the computation
  const refreshPromise = compute()
    .then((data) => {
      store.set(key, { data, expiresAt: Date.now() + ttlMs })
      return data
    })
    .catch((err) => {
      // On failure, clear the refreshing promise so next caller retries
      const current = store.get(key)
      if (current) {
        delete current.refreshingPromise
      }
      // If we have stale data, return it instead of throwing
      if (entry?.data) {
        console.warn(`[CACHE] Query failed for "${key}", returning stale data:`, err.message)
        return entry.data as T
      }
      throw err
    })

  // Store the refreshing promise so concurrent callers can wait on it
  if (entry) {
    entry.refreshingPromise = refreshPromise
  } else {
    store.set(key, { data: null as any, expiresAt: 0, refreshingPromise: refreshPromise })
  }

  return refreshPromise
}

/**
 * Invalidate a specific cache key or all keys matching a prefix.
 */
export function invalidateCache(keyOrPrefix?: string) {
  if (!keyOrPrefix) {
    store.clear()
    return
  }
  for (const key of store.keys()) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix + ':')) {
      store.delete(key)
    }
  }
}
