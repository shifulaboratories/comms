import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { FIELD_LAST_MESSAGE_AT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: FIELD_LAST_MESSAGE_AT_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: 'commsLastMessageAt',
  type: FieldType.DATE_TIME,
  label: 'Last iMessage',
  description:
    'When the last iMessage with this person was sent or received, from Comms.',
  icon: 'IconMessageCircle',
  isNullable: true,
  isUIEditable: false,
  isAuditLogged: false,
});
