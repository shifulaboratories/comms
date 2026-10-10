import { describe, expect, it } from 'vitest';

import { phoneKey, verifyCommsSignature } from 'src/lib/comms';

// Pinned in Comms too (packages/core/test/webhooks.test.ts): a signature Comms
// produces must verify here.
const BODY = JSON.stringify({ id: 'evt_1', type: 'message.received' });
const T = 1760000000;
const HEADER =
  't=1760000000,v1=828d1b86131fac741afbf973332569b320b0a24202f40704f4220dcf22a6dac0';

describe('verifyCommsSignature', () => {
  it('accepts a signature from Comms', () => {
    expect(verifyCommsSignature('whsec_test', BODY, HEADER, T + 5)).toBe(true);
  });

  it('rejects a changed body, the wrong secret, an old timestamp and no header', () => {
    expect(verifyCommsSignature('whsec_test', `${BODY} `, HEADER, T)).toBe(
      false,
    );
    expect(verifyCommsSignature('whsec_nope', BODY, HEADER, T)).toBe(false);
    expect(verifyCommsSignature('whsec_test', BODY, HEADER, T + 600)).toBe(
      false,
    );
    expect(verifyCommsSignature('whsec_test', BODY, undefined, T)).toBe(false);
  });
});

describe('phoneKey', () => {
  it('matches E.164 to national format', () => {
    expect(phoneKey('+14155550177')).toBe('4155550177');
    expect(phoneKey('(415) 555-0177')).toBe('4155550177');
    expect(phoneKey('+1' + '4155550177')).toBe(phoneKey('415.555.0177'));
    expect(phoneKey('123')).toBeNull();
  });
});
