import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { FIELD_CONVERSATION_LINK_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: FIELD_CONVERSATION_LINK_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: 'commsConversation',
  type: FieldType.LINKS,
  label: 'Comms conversation',
  description: 'Opens this person’s thread in Comms.',
  icon: 'IconExternalLink',
  isNullable: true,
  isUIEditable: false,
  isAuditLogged: false,
});
