// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxt/icon'],

  // Import Tailwind CSS
  css: ['~/assets/css/main.css'],

  // Force dark mode
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    classSuffix: ''
  },

  // Cloudflare orange theme - pure black/gray/white with orange accent
  ui: {
    colors: {
      primary: 'orange',
      neutral: 'neutral'
    }
  },

  // Runtime configuration
  runtimeConfig: {
    // Server-only (private) - available via useRuntimeConfig() in server
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN || '',
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    databaseUrl: process.env.DATABASE_URL || '',
    ingestAuthToken: process.env.INGEST_AUTH_TOKEN || '',

    // Public - available on client via useRuntimeConfig().public
    public: {
      appName: 'NIMBUS'
    }
  },

  // Nitro server configuration
  nitro: {
    experimental: {
      tasks: true
    }
  },

  // App configuration
  app: {
    head: {
      title: 'NIMBUS - Cloudflare Log Dashboard',
      meta: [
        { name: 'description', content: 'Custom dashboard for Cloudflare Logpush data' }
      ]
    }
  }
})