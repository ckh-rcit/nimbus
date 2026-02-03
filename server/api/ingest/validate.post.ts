/**
 * Validation endpoint for Cloudflare Logpush
 * Cloudflare sends a test payload to verify the destination before enabling the job
 */
export default defineEventHandler(async (event) => {
  // Cloudflare sends a gzipped test.txt.gz with content: {"content":"tests"}
  // We just need to respond with 200 OK to pass validation
  
  console.log('[Ingest] Received validation request from Cloudflare')
  
  return {
    success: true,
    message: 'Validation successful'
  }
})
