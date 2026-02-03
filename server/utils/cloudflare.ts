import type { CloudflareZone, CloudflareApiResponse } from '~~/shared/types'

const CF_API_BASE = 'https://api.cloudflare.com/client/v4'

/**
 * Verify Cloudflare API token is valid
 */
export async function verifyCloudflareToken(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(`${CF_API_BASE}/user/tokens/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json() as CloudflareApiResponse<{ status: string }>

    if (!response.ok || !data.success) {
      const errorMessage = data.errors?.[0]?.message || 'Token verification failed'
      return { valid: false, error: errorMessage }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: `Failed to verify token: ${error}` }
  }
}

/**
 * Fetch all zones for an account (handles pagination for 50+ zones)
 */
export async function fetchAllZones(token: string, accountId: string): Promise<CloudflareZone[]> {
  const allZones: CloudflareZone[] = []
  let page = 1
  const perPage = 50
  let hasMore = true

  while (hasMore) {
    const url = new URL(`${CF_API_BASE}/zones`)
    url.searchParams.set('account.id', accountId)
    url.searchParams.set('page', page.toString())
    url.searchParams.set('per_page', perPage.toString())
    url.searchParams.set('order', 'name')
    url.searchParams.set('direction', 'asc')

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch zones: ${response.statusText}`)
    }

    const data = await response.json() as CloudflareApiResponse<CloudflareZone[]>

    if (!data.success) {
      throw new Error(`Cloudflare API error: ${data.errors?.[0]?.message || 'Unknown error'}`)
    }

    allZones.push(...data.result)

    // Check if there are more pages
    const resultInfo = data.result_info
    if (resultInfo) {
      hasMore = page < resultInfo.total_pages
      page++
    } else {
      hasMore = false
    }
  }

  console.log(`[Cloudflare] Fetched ${allZones.length} zones for account ${accountId}`)
  return allZones
}

/**
 * Sync zones from Cloudflare API to database
 */
export async function syncZonesToDatabase(): Promise<{ synced: number; zones: string[] }> {
  const config = useRuntimeConfig()
  const db = getDatabase()
  const { zones: zonesTable } = await import('../database/schema')

  // Fetch zones from Cloudflare
  const cloudflareZones = await fetchAllZones(
    config.cloudflareApiToken,
    config.cloudflareAccountId
  )

  // Upsert zones to database
  const now = new Date()
  const zoneNames: string[] = []

  for (const zone of cloudflareZones) {
    await db.insert(zonesTable)
      .values({
        id: zone.id,
        name: zone.name,
        status: zone.status,
        accountId: zone.account.id,
        syncedAt: now
      })
      .onConflictDoUpdate({
        target: zonesTable.id,
        set: {
          name: zone.name,
          status: zone.status,
          accountId: zone.account.id,
          syncedAt: now
        }
      })
    
    zoneNames.push(zone.name)
  }

  console.log(`[Cloudflare] Synced ${cloudflareZones.length} zones to database`)
  return { synced: cloudflareZones.length, zones: zoneNames }
}

// Import database helper
import { getDatabase } from '~~/server/database'
