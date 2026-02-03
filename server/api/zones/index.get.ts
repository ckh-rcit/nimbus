import { getDatabase, schema } from '~~/server/database'

export default defineEventHandler(async () => {
  const db = getDatabase()
  
  const allZones = await db.select().from(schema.zones).orderBy(schema.zones.name)
  
  return {
    zones: allZones,
    count: allZones.length
  }
})
