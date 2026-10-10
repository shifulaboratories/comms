import { defineApplicationRole } from 'twenty-sdk/define';

import {
  APP_DISPLAY_NAME,
  DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The app reads people to match them to Comms contacts, and writes only its
// own "last texted" fields on them. It never deletes anything.
export default defineApplicationRole({
  universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  label: `${APP_DISPLAY_NAME} default function role`,
  description: `${APP_DISPLAY_NAME} reads people and updates their iMessage fields.`,
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
});
