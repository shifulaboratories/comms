import { describe, it, expect } from 'vitest';
import { signWebhook, verifyWebhook } from '../src/webhooks.js';

// The same vector is pinned in integrations/twenty/src/lib/__tests__/comms.test.ts,
// so Comms' signing and the Twenty app's verification can't drift apart.
const BODY = JSON.stringify({ id: 'evt_1', type: 'message.received' });
const T = 1760000000;
const HEADER = 't=1760000000,v1=828d1b86131fac741afbf973332569b320b0a24202f40704f4220dcf22a6dac0';

describe('webhook signatures', () => {
  it('signs to the pinned vector', () => {
    expect(signWebhook('whsec_test', BODY, T)).toBe(HEADER);
  });

  it('verifies a fresh signature and rejects tampering, wrong keys and replays', () => {
    expect(verifyWebhook('whsec_test', BODY, HEADER, 300, T + 10)).toBe(true);
    expect(verifyWebhook('whsec_test', BODY + ' ', HEADER, 300, T)).toBe(false);
    expect(verifyWebhook('whsec_other', BODY, HEADER, 300, T)).toBe(false);
    expect(verifyWebhook('whsec_test', BODY, HEADER, 300, T + 301)).toBe(false);
    expect(verifyWebhook('whsec_test', BODY, null, 300, T)).toBe(false);
    expect(verifyWebhook('whsec_test', BODY, 't=abc,v1=00', 300, T)).toBe(false);
  });
});
