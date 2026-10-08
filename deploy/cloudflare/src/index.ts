import { Container, getContainer } from '@cloudflare/containers';

/**
 * Comms on Cloudflare.
 *
 * The app is a long-running Node service (Next.js) plus a BullMQ worker, so it
 * can't run as a Worker script — both run as Cloudflare Containers built from
 * the repo's root Dockerfile, the same image Railway and docker-compose use.
 * This Worker is only the front door:
 *
 *   request ─▶ Worker ─▶ CommsWeb container (next start, :3000)
 *   cron    ─▶ Worker ─▶ CommsWorker container (BullMQ, no port)
 *
 * Postgres and Redis are not Cloudflare products, so DATABASE_URL and
 * REDIS_URL point at an external provider (Neon/Supabase, Upstash…).
 * Attachments can use R2 through its S3 API — no code change, just S3_* vars.
 */

interface Env {
  WEB: DurableObjectNamespace<CommsWeb>;
  WORKER: DurableObjectNamespace<CommsWorker>;
  // Everything else is a plain var or secret, forwarded to the containers.
  [key: string]: unknown;
}

/**
 * Every string var and secret on the Worker becomes an env var in both
 * containers, so configuring Comms here works exactly like on Railway: set
 * DATABASE_URL, REDIS_URL, APP_URL, and any optional SMTP_/S3_/OAuth keys.
 * Bindings (the container namespaces) are objects and are skipped.
 */
function containerEnv(env: Env): Record<string, string> {
  const out: Record<string, string> = { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' };
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string' && value !== '') out[key] = value;
  }
  return out;
}

const REQUIRED = ['DATABASE_URL', 'REDIS_URL', 'APP_URL'] as const;

function missingConfig(env: Env): string[] {
  return REQUIRED.filter((key) => typeof env[key] !== 'string' || env[key] === '');
}

export class CommsWeb extends Container<Env> {
  defaultPort = 3000;
  // Idle web containers sleep; the next request (or BlueBubbles webhook)
  // wakes one in a few seconds. Open SSE streams count as activity.
  sleepAfter = '30m';
  // Migrations run before every boot — the equivalent of Railway's
  // preDeployCommand. Drizzle skips already-applied ones, so this is a no-op
  // on all but the first boot after a schema change. `next` is called
  // directly rather than through pnpm: the runtime image has no cached pnpm
  // and corepack would fetch one from npm on every cold start.
  entrypoint = [
    'sh',
    '-c',
    'node packages/db/dist/migrate.js && exec apps/web/node_modules/.bin/next start apps/web -p 3000 -H 0.0.0.0',
  ];

  constructor(ctx: DurableObjectState<{}>, env: Env) {
    super(ctx, env);
    this.envVars = { ...containerEnv(env), PORT: '3000' };
  }
}

export class CommsWorker extends Container<Env> {
  // The queue worker listens on nothing; it only needs to stay up. The cron
  // below renews this every minute, so it only lapses if crons stop firing.
  sleepAfter = '5m';
  entrypoint = ['node', 'apps/worker/dist/index.js'];

  constructor(ctx: DurableObjectState<{}>, env: Env) {
    super(ctx, env);
    this.envVars = containerEnv(env);
  }

  /** Start the worker if it isn't running (first deploy, crash, host restart). */
  async keepAlive(): Promise<string> {
    const { status } = await this.getState();
    if (status !== 'running' && status !== 'healthy') await this.start();
    this.renewActivityTimeout();
    return status;
  }
}

// One web and one worker instance, matching `numReplicas: 1` on Railway —
// migrations run on web boot and assume nothing else is booting alongside.
const SINGLETON = 'comms';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const missing = missingConfig(env);
    if (missing.length) {
      return new Response(
        `Comms is not configured yet. Set ${missing.join(', ')} on this Worker ` +
          '(wrangler secret put <NAME>) and redeploy. See deploy/cloudflare/README.md.',
        { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } },
      );
    }
    // Any traffic also nudges the worker, so a fresh deploy doesn't wait for
    // the first cron tick before messages start flowing.
    ctx.waitUntil(
      getContainer(env.WORKER, SINGLETON)
        .keepAlive()
        .catch(() => {}),
    );
    return getContainer(env.WEB, SINGLETON).fetch(request);
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (missingConfig(env).length) return;
    ctx.waitUntil(getContainer(env.WORKER, SINGLETON).keepAlive());
  },
} satisfies ExportedHandler<Env>;
