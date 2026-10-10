import { defineHealthCheck } from 'twenty-sdk/define';

import { HEALTH_CHECK_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { comms, CommsApiError, CommsNotConfiguredError } from 'src/lib/comms';

// Runs when the app's settings page opens: proves the URL and key work.
export default defineHealthCheck({
  universalIdentifier: HEALTH_CHECK_UNIVERSAL_IDENTIFIER,
  name: 'health-check',
  handler: async () => {
    if (!process.env.COMMS_WEBHOOK_SECRET?.trim()) {
      return {
        status: 'ERROR',
        title: 'Webhook secret missing',
        description:
          'Add COMMS_WEBHOOK_SECRET so new messages can update people in Twenty.',
      };
    }
    try {
      const me = await comms<{ user: { email: string }; scopes: string[] }>(
        'GET',
        '/me',
      );
      if (!me.scopes.includes('write')) {
        return {
          status: 'ERROR',
          title: 'Key is read-only',
          description:
            'Replying from Twenty needs a key with write access. Reconnect Twenty in Comms.',
        };
      }
      return { status: 'OK' };
    } catch (err) {
      if (err instanceof CommsNotConfiguredError) {
        return {
          status: 'ERROR',
          title: 'Not configured',
          description: err.message,
        };
      }
      if (err instanceof CommsApiError && err.status === 401) {
        return {
          status: 'ERROR',
          title: 'Comms rejected the key',
          description:
            'The key was revoked or mistyped. Reconnect Twenty in Comms → Settings → Integrations.',
        };
      }
      return {
        status: 'ERROR',
        title: 'Can’t reach Comms',
        description: err instanceof Error ? err.message : String(err),
      };
    }
  },
});
