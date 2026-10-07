# Deploy Comms to Cloudflare

Comms runs on Cloudflare as two [Containers](https://developers.cloudflare.com/containers/)
behind one Worker. Both are built from the repo's root `Dockerfile` — the same image Railway
and `docker compose` run — so nothing in the app changes:

```
 browser / BlueBubbles ─▶ Worker ─▶ CommsWeb container     (Next.js, migrations on boot)
 cron, every minute    ─▶ Worker ─▶ CommsWorker container  (BullMQ queue worker)
```

Cloudflare has no managed Postgres or Redis, so those two come from an outside provider.
Attachments can stay on Cloudflare: R2 speaks the S3 API Comms already uses.

| Comms needs            | Use                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Postgres               | [Neon](https://neon.tech), [Supabase](https://supabase.com), or any Postgres reachable over the internet                |
| Redis                  | [Upstash](https://upstash.com) (use the `rediss://` TCP URL, not the REST API) or any Redis reachable over the internet |
| Attachments (optional) | Cloudflare R2                                                                                                           |

Containers require a Workers Paid plan.

## 1. Prerequisites

- Node 22 and Docker running locally (Wrangler builds the image with it).
- `npx wrangler login`.
- A Postgres URL and a Redis URL from the providers above.

## 2. Configure

From this directory:

```bash
cd deploy/cloudflare
npm install

npx wrangler secret put DATABASE_URL   # postgres://…?sslmode=require
npx wrangler secret put REDIS_URL      # rediss://default:…@….upstash.io:6379
```

Every var and secret on this Worker is passed into both containers as an environment
variable, so the [`.env.example`](../../.env.example) at the repo root is the full list of
what you can set. Secrets go in with `wrangler secret put`; plain values can go in `vars` in
`wrangler.jsonc`.

`APP_SECRET` is optional, as on Railway — without it, Comms generates one and stores it in the
database on first boot.

## 3. Deploy

```bash
npx wrangler deploy
```

The first deploy builds and pushes the image, which takes a few minutes. Wrangler then prints
your URL (`https://comms.<your-subdomain>.workers.dev`), or attach a custom domain in the
dashboard.

Comms can't work out its public URL on Cloudflare the way it does on Railway, so set it now and
deploy again:

```jsonc
// wrangler.jsonc
"vars": { "APP_URL": "https://comms.<your-subdomain>.workers.dev" }
```

```bash
npx wrangler deploy
```

Until `DATABASE_URL`, `REDIS_URL` and `APP_URL` are all set, the Worker answers with a 503 that
names what's missing instead of starting the containers.

Open the URL and run the setup wizard. The first request takes a few seconds while the web
container boots and runs migrations.

## Attachments on R2 (optional)

Create a bucket and an R2 API token (**R2 → Manage API tokens**, Object Read & Write), then:

```jsonc
// wrangler.jsonc → vars
"S3_ENDPOINT": "https://<ACCOUNT_ID>.r2.cloudflarestorage.com",
"S3_BUCKET": "comms",
"S3_REGION": "auto"
```

```bash
npx wrangler secret put S3_ACCESS_KEY_ID
npx wrangler secret put S3_SECRET_ACCESS_KEY
npx wrangler deploy
```

## How it behaves

- **The web container sleeps** after 30 minutes with no requests and wakes on the next one,
  BlueBubbles webhooks included. Expect a few seconds of cold start on the first request after
  a quiet spell. Change `sleepAfter` in `src/index.ts` to trade cost for latency.
- **The worker container stays up.** A cron trigger runs every minute and starts it if it isn't
  running — after the first deploy, a crash, or Cloudflare moving it to another host.
- **One of each.** `max_instances` is 1 for both, matching one web and one worker replica on
  Railway.
- **Migrations run on every web boot**, before Next.js starts. Already-applied migrations are
  skipped, so this only does work after a schema change.
- **Logs:** `npx wrangler tail` for the Worker; container logs are in the dashboard under
  **Workers & Pages → Containers**.

## The marketing site

`apps/www` deploys separately, as static files with no containers at all:

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain pnpm --filter @comms/www deploy:cloudflare
```

That runs a static export (`STATIC_EXPORT=1 next build`) and uploads `apps/www/out` as
[Workers static assets](https://developers.cloudflare.com/workers/static-assets/) using
`apps/www/wrangler.jsonc`.
