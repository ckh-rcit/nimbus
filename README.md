# NIMBUS - Cloudflare Log Dashboard

A custom dashboard for displaying and searching Cloudflare Logpush data. Built with Nuxt 4, Bun, PostgreSQL, and Drizzle ORM.

![NIMBUS Dashboard](https://img.shields.io/badge/Cloudflare-F6821F?logo=cloudflare&logoColor=white) ![Nuxt](https://img.shields.io/badge/Nuxt%204-00DC82?logo=nuxt&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)

## Features

- 📊 **Multi-dataset support**: HTTP requests, Firewall events, DNS logs, Audit logs, and more
- 🔍 **Full-text search**: Search across all log fields
- 🌐 **Zone management**: Auto-discovers zones from Cloudflare API (supports 50+ zones)
- ⏱️ **Time range filtering**: Quick presets from 15 minutes to 30 days
- 🔄 **Auto-refresh**: Optional 30-second polling for real-time monitoring
- 🎨 **Dark theme**: Vercel-inspired UI with Cloudflare orange accents
- 🐳 **Docker ready**: Deploy easily via Portainer/Docker Compose

## Prerequisites

- [Bun](https://bun.sh/) runtime (v1.0+)
- PostgreSQL database (v14+)
- Cloudflare account with:
  - API token with `Zone.Zone:Read` permission
  - Account ID

## Quick Start

### 1. Clone and install dependencies

```bash
git clone <your-repo>
cd nimbus
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
DATABASE_URL=postgres://nimbus:nimbus@localhost:5432/nimbus
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
INGEST_AUTH_TOKEN=your_secure_random_token
```

### 3. Setup database

```bash
# Start PostgreSQL (if using Docker)
docker run -d --name nimbus-postgres \
  -e POSTGRES_USER=nimbus \
  -e POSTGRES_PASSWORD=nimbus \
  -e POSTGRES_DB=nimbus \
  -p 5432:5432 \
  postgres:16-alpine

# Run migrations
bun run db:push
```

### 4. Start development server

```bash
bun run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Database Commands

```bash
# Generate migrations
bun run db:generate

# Push schema to database
bun run db:push

# Open Drizzle Studio
bun run db:studio
```

## Docker Deployment

### Using Docker Compose

```bash
# Set environment variables
export CLOUDFLARE_API_TOKEN=your_token
export CLOUDFLARE_ACCOUNT_ID=your_account_id
export INGEST_AUTH_TOKEN=your_secure_token

# Build and start
docker-compose up -d
```

### Using Portainer

1. Create a new stack in Portainer
2. Paste the contents of `docker-compose.yml`
3. Add environment variables in Portainer's UI
4. Deploy the stack

## Configuring Cloudflare Logpush

### 1. Create a Logpush job

In Cloudflare Dashboard:
1. Go to **Analytics & Logs** → **Logpush**
2. Click **Create a Logpush job**
3. Select your dataset (e.g., HTTP requests)
4. Choose **HTTP** as destination

### 2. Configure HTTP destination

**Destination URL format:**
```
https://your-nimbus-domain.com/api/ingest/{dataset}?header_Authorization=Bearer%20{YOUR_INGEST_TOKEN}
```

**Example for HTTP requests:**
```
https://nimbus.example.com/api/ingest/http_requests?header_Authorization=Bearer%20your_secure_token
```

### 3. Available dataset endpoints

| Dataset | Endpoint | Scope |
|---------|----------|-------|
| HTTP Requests | `/api/ingest/http_requests` | Zone |
| Firewall Events | `/api/ingest/firewall_events` | Zone |
| DNS Logs | `/api/ingest/dns_logs` | Zone |
| Spectrum Events | `/api/ingest/spectrum_events` | Zone |
| Audit Logs | `/api/ingest/audit_logs` | Account |
| Gateway DNS | `/api/ingest/gateway_dns` | Account |
| Gateway HTTP | `/api/ingest/gateway_http` | Account |
| Workers Traces | `/api/ingest/workers_trace_events` | Account |

### 4. Validate the destination

Cloudflare will send a test request to verify your endpoint. The endpoint at `/api/ingest/validate` handles this automatically.

## API Endpoints

### Zones

- `GET /api/zones` - List all cached zones
- `POST /api/zones/sync` - Sync zones from Cloudflare API

### Logs

- `GET /api/logs` - Query logs with filters
  - `?dataset=http_requests` - Filter by dataset
  - `?zoneId=abc123` - Filter by zone
  - `?search=example.com` - Search in logs
  - `?startTime=2024-01-01T00:00:00Z` - Start time filter
  - `?endTime=2024-01-02T00:00:00Z` - End time filter
  - `?limit=100` - Results per page (max 1000)
  - `?offset=0` - Pagination offset

### Ingestion

- `POST /api/ingest/{dataset}` - Receive Logpush data
- `POST /api/ingest/validate` - Validation endpoint for Cloudflare

### Stats

- `GET /api/stats` - Dashboard statistics

## Project Structure

```
nimbus/
├── app/
│   ├── layouts/
│   │   └── default.vue      # Main layout with sidebar
│   ├── pages/
│   │   ├── index.vue        # Dashboard home
│   │   └── logs/
│   │       └── [dataset].vue # Log viewer
│   └── app.vue
├── server/
│   ├── api/
│   │   ├── ingest/          # Logpush ingestion
│   │   ├── logs/            # Log queries
│   │   ├── zones/           # Zone management
│   │   └── stats/           # Statistics
│   ├── database/
│   │   ├── schema.ts        # Drizzle schema
│   │   └── index.ts         # DB client
│   ├── plugins/
│   │   └── startup.ts       # Token validation & zone sync
│   └── utils/
│       └── cloudflare.ts    # CF API client
├── shared/
│   └── types/
│       └── index.ts         # TypeScript types
├── docker-compose.yml
├── Dockerfile
└── drizzle.config.ts
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `CLOUDFLARE_API_TOKEN` | CF API token with Zone.Zone:Read | Yes |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID | Yes |
| `INGEST_AUTH_TOKEN` | Token for authenticating Logpush | Yes |

## Security Notes

- Always use HTTPS in production for the ingestion endpoint
- Rotate `INGEST_AUTH_TOKEN` periodically
- The Cloudflare API token only needs read access to zones
- Consider adding IP allowlisting for Cloudflare's Logpush IPs

## License

MIT
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
