import { syncZonesToDatabase } from '../../utils/cloudflare'

export default defineEventHandler(async () => {
  try {
    const result = await syncZonesToDatabase()
    
    return {
      success: true,
      message: `Synced ${result.synced} zones`,
      zones: result.zones
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to sync zones: ${error}`
    })
  }
})
