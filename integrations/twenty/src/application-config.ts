import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  VAR_COMMS_API_KEY_UNIVERSAL_IDENTIFIER,
  VAR_COMMS_URL_UNIVERSAL_IDENTIFIER,
  VAR_COMMS_WEBHOOK_SECRET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  logo: 'public/logo.svg',
  // All three come from Comms: Settings → Integrations → Twenty CRM → Connect.
  applicationVariables: {
    COMMS_URL: {
      universalIdentifier: VAR_COMMS_URL_UNIVERSAL_IDENTIFIER,
      description:
        'Address of your Comms workspace, e.g. https://comms.example.com',
      isSecret: false,
      isRequired: true,
    },
    COMMS_API_KEY: {
      universalIdentifier: VAR_COMMS_API_KEY_UNIVERSAL_IDENTIFIER,
      description: 'The cms_… key Comms gave you when you connected Twenty.',
      isSecret: true,
      isRequired: true,
    },
    COMMS_WEBHOOK_SECRET: {
      universalIdentifier: VAR_COMMS_WEBHOOK_SECRET_UNIVERSAL_IDENTIFIER,
      description:
        'The whsec_… secret Comms signs new-message notifications with.',
      isSecret: true,
      isRequired: true,
    },
  },
});
