import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Sign a webhook body the way receivers verify it:
 * `Comms-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`.
 * Including the timestamp lets a receiver reject replays.
 */
export function signWebhook(secret: string, body: string, timestamp: number): string {
  const v1 = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${v1}`;
}

/** Verify a `Comms-Signature` header. Tolerance is in seconds. */
export function verifyWebhook(
  secret: string,
  body: string,
  header: string | null | undefined,
  toleranceSeconds = 300,
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const i = kv.indexOf('=');
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(now - t) > toleranceSeconds || !parts.v1) return false;
  const expected = signWebhook(secret, body, t).split('v1=')[1]!;
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(parts.v1, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
