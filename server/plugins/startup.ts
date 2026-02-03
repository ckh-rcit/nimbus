import { verifyCloudflareToken, syncZonesToDatabase } from '../utils/cloudflare'

export default defineNitroPlugin(async (nitroApp) => {
  const config = useRuntimeConfig()

  console.log('[NIMBUS] Starting server initialization...')

  // Validate required configuration
  const requiredEnvVars = [
    { key: 'cloudflareApiToken', name: 'CLOUDFLARE_API_TOKEN' },
    { key: 'cloudflareAccountId', name: 'CLOUDFLARE_ACCOUNT_ID' },
    { key: 'databaseUrl', name: 'DATABASE_URL' },
    { key: 'ingestAuthToken', name: 'INGEST_AUTH_TOKEN' }
  ]

  const missingVars = requiredEnvVars.filter(v => !config[v.key as keyof typeof config])
  
  if (missingVars.length > 0) {
    const missing = missingVars.map(v => v.name).join(', ')
    console.error(`[NIMBUS] Missing required environment variables: ${missing}`)
    console.error('[NIMBUS] Please configure these in your .env file')
    // Don't crash in dev mode, just warn
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variables: ${missing}`)
    }
    return
  }

  // Verify Cloudflare API token
  console.log('[NIMBUS] Verifying Cloudflare API token...')
  const tokenResult = await verifyCloudflareToken(config.cloudflareApiToken)
  
  if (!tokenResult.valid) {
    console.error(`[NIMBUS] Cloudflare API token verification failed: ${tokenResult.error}`)
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Cloudflare API token invalid: ${tokenResult.error}`)
    }
    console.warn('[NIMBUS] Continuing in development mode with invalid token')
    return
  }

  console.log('[NIMBUS] Cloudflare API token verified successfully')

  // Sync zones on startup
  try {
    console.log('[NIMBUS] Syncing zones from Cloudflare...')
    const result = await syncZonesToDatabase()
    console.log(`[NIMBUS] Initial zone sync complete: ${result.synced} zones`)
  } catch (error) {
    console.error('[NIMBUS] Failed to sync zones on startup:', error)
    if (process.env.NODE_ENV === 'production') {
      throw error
    }
  }

  console.log('[NIMBUS] Server initialization complete')
})
