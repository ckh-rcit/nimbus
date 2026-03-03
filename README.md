# NIMBUS

A self-hosted dashboard for ingesting, searching, and analyzing Cloudflare Logpush data. Built with Nuxt 4, PostgreSQL, and Drizzle ORM.

![NIMBUS Dashboard](https://img.shields.io/badge/Cloudflare-F6821F?logo=cloudflare&logoColor=white) ![Nuxt](https://img.shields.io/badge/Nuxt%204-00DC82?logo=nuxt&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)

NIMBUS receives log data directly from Cloudflare Logpush via HTTP destination, stores it in PostgreSQL, and provides a web interface for exploring HTTP request and firewall event logs across all your zones.

<img width="1912" height="948" alt="msedge_qDO1HiluZq" src="https://github.com/user-attachments/assets/8741d0f0-257b-4c46-a378-714c06f0adf1" />

---

## Features

- **Unified log ingestion** -- Single HTTP endpoint receives Cloudflare Logpush data for HTTP requests and firewall events, with automatic dataset detection.
- **Pre-aggregated analytics** -- Write-time rollup table powers the dashboard without scanning millions of raw log rows. Top talkers, firewall action breakdown, and most targeted zones all query a compact summary table.
- **Full-text and field-level search** -- Search across all log fields or target specific columns (Client IP, Ray ID, host, path, etc.).
- **Zone management** -- Auto-discovers zones from the Cloudflare API on startup. Supports accounts with 50+ zones.
- **Time range filtering** -- Presets from 15 minutes to 30 days, plus an "All Time" option.
- **Auto-refresh** -- Optional 30-second polling for near-real-time monitoring.
- **Filterable log viewer** -- Click any cell value to add it as a filter. Filters are composable and persist in the URL for sharing.
- **Detailed log expansion** -- Expand any log row to see all fields grouped by category (Request, Client, Response, Cache, Security, Bot, TLS, Edge, etc.) with scrollable cards for large payloads.
- **IP enrichment** -- Client IP tooltips show ISP/organization, ASN, and country code using data already present in Cloudflare logs.
- **Clickable firewall actions** -- Click an action in the dashboard to jump directly to filtered firewall event logs.
- **CSV export** -- Export the current log view to CSV.
- **In-memory cache with stampede protection** -- Prevents redundant database queries under concurrent load.
- **Dark theme** -- Minimal dark UI with Cloudflare orange accents.
- **Docker ready** -- Single-container deployment via Docker Compose or Portainer.

---

## Requirements

- [Bun](https://bun.sh/) runtime (v1.0+)
- PostgreSQL 14+
- Cloudflare account with:
  - API token with `Zone.Zone:Read` permission
  - Account ID
  - One or more Logpush jobs configured to send to this instance

---

## Quick Start

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

Create a `.env` file in the project root:

```env
DATABASE_URL=postgres://nimbus:your_password@localhost:5432/nimbus
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
INGEST_AUTH_TOKEN=your_secure_random_token
```

### 3. Set up the database

```bash
# Start PostgreSQL (if using Docker)
docker run -d --name nimbus-postgres \
  -e POSTGRES_USER=nimbus \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=nimbus \
  -p 5432:5432 \
  postgres:16-alpine

# Push the schema
bun run db:push

# Create expression indexes for query performance
bun run db:indexes
```

### 4. Start the development server

```bash
bun run dev
```

The application will be available at `http://localhost:3000`. On first start, NIMBUS verifies the Cloudflare API token and syncs all zones from your account.

---

## Database Commands

```bash
bun run db:push       # Push schema to database
bun run db:generate   # Generate migration files
bun run db:studio     # Open Drizzle Studio (visual schema browser)
bun run db:indexes    # Create expression indexes on JSONB fields
```

Note: `db:push` drops manually-created expression indexes. Always run `db:indexes` after a schema push.

---

## Docker Deployment

### Docker Compose

```bash
docker-compose up -d
```

Environment variables can be set in the shell, in a `.env` file, or passed directly in the compose file.

### Portainer

1. Create a new stack in Portainer.
2. Paste the contents of `docker-compose.yml`.
3. Add the four required environment variables in the Portainer UI.
4. Deploy the stack.

---

## Configuring Cloudflare Logpush

NIMBUS uses a single ingestion endpoint. Cloudflare Logpush sends batches of newline-delimited JSON (NDJSON) to this endpoint, and NIMBUS detects the dataset automatically based on the fields present in each batch.

### Destination URL format

```
https://your-domain.com/api/ingest?token=YOUR_INGEST_TOKEN
```

### Setting up a Logpush job

1. In the Cloudflare Dashboard, go to **Analytics & Logs** then **Logpush**.
2. Click **Create a Logpush job**.
3. Select the dataset (HTTP requests or Firewall events).
4. Choose **Custom HTTP** as the destination.
5. Enter the destination URL shown above.
6. Cloudflare will send a validation request -- the endpoint handles this automatically.
7. Select the fields you want to include (all fields are supported).

### Supported datasets

| Dataset | Scope | Description |
|---------|-------|-------------|
| HTTP Requests | Zone | Client requests, edge/origin response details, cache status, TLS, bot scores |
| Firewall Events | Zone | WAF actions, rate limiting, managed challenges, rule metadata |

---

## API Reference

### Zones

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/zones` | List all synced zones |
| POST | `/api/zones/sync` | Re-sync zones from Cloudflare API |

### Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/logs` | Query logs with filters |

Query parameters for `/api/logs`:

| Parameter | Type | Description |
|-----------|------|-------------|
| `dataset` | string | `http_requests` or `firewall_events` |
| `zoneId` | string | Filter by zone ID |
| `search` | string | Full-text search across log fields |
| `searchField` | string | Restrict search to a specific field |
| `filters` | JSON string | Array of `{field, value}` exact-match filters |
| `startTime` | ISO 8601 | Start of time range |
| `endTime` | ISO 8601 | End of time range |
| `limit` | number | Results per page (default 100, max 1000) |
| `offset` | number | Pagination offset |

### Statistics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Dashboard overview (total logs, zones, logs today) |
| GET | `/api/stats/top-talkers` | Top hosts, IPs, firewall actions, most targeted zones |

### Ingestion

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ingest` | Receive Logpush data (auto-detects dataset) |

---

## Project Structure

```
nimbus/
  app/
    layouts/
      default.vue           Main layout with sidebar navigation
    pages/
      index.vue             Dashboard with stats and top talkers
      logs/
        [dataset].vue       Log viewer with search, filters, pagination
  server/
    api/
      ingest.post.ts        Logpush ingestion with auto-detection
      logs/index.get.ts     Log query endpoint
      stats/index.get.ts    Dashboard statistics
      stats/top-talkers.get.ts  Pre-aggregated analytics
      zones/index.get.ts    Zone listing
      zones/sync.post.ts    Zone sync from Cloudflare
    database/
      schema.ts             Drizzle ORM schema (logs, zones, stats_rollup)
      index.ts              Database connection with pool + statement timeout
    plugins/
      startup.ts            Token verification and initial zone sync
    utils/
      cache.ts              In-memory cache with stampede protection
      cloudflare.ts         Cloudflare API client
      rollup.ts             Write-time pre-aggregation logic
  shared/
    types/index.ts          Shared TypeScript types and dataset configs
  scripts/
    add-analytics-indexes.ts  Expression index migration
    reset-db.ts             Database reset utility
```

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with `Zone.Zone:Read` | Yes |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID | Yes |
| `INGEST_AUTH_TOKEN` | Bearer token for authenticating Logpush requests | Yes |

---

## Performance Notes

NIMBUS is designed to handle millions of log rows efficiently:

- **Pre-aggregation**: A `stats_rollup` table is populated at ingest time. Dashboard queries read from this small summary table instead of scanning raw logs.
- **Expression indexes**: JSONB fields used in common queries (host, status, action) have partial expression indexes.
- **Statement timeout**: All database connections enforce a 20-second statement timeout to prevent runaway queries.
- **Connection pooling**: A pool of 10 persistent connections is shared across all requests.
- **Caching**: API responses are cached in memory with configurable TTL (30 seconds for stats, 5 minutes for top talkers). Stampede protection ensures only one caller runs an expensive query while others wait.

After running `drizzle-kit push`, always run `bun run db:indexes` to restore the expression indexes (drizzle-kit drops indexes it does not manage).

---

## Security

- Use HTTPS in production for the ingestion endpoint.
- Rotate `INGEST_AUTH_TOKEN` periodically.
- The Cloudflare API token only requires read access to zones.
- Consider restricting ingestion to Cloudflare's published Logpush IP ranges.

---

## License

AGPL-3.0 -- see [LICENSE](LICENSE) for details.
