import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { FIELD_LAST_MESSAGE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: FIELD_LAST_MESSAGE_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  name: 'commsLastMessage',
  type: FieldType.TEXT,
  label: 'Last iMessage text',
  description:
    'The most recent iMessage with this person, prefixed with who sent it.',
  icon: 'IconMessage',
  isNullable: true,
  isUIEditable: false,
  isAuditLogged: false,
});
