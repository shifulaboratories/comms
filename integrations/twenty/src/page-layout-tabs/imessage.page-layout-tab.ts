import {
  definePageLayoutTab,
  PageLayoutTabLayoutMode,
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  FRONT_THREAD_UNIVERSAL_IDENTIFIER,
  TAB_IMESSAGE_UNIVERSAL_IDENTIFIER,
  WIDGET_IMESSAGE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// An "iMessage" tab on every person's record page.
export default definePageLayoutTab({
  universalIdentifier: TAB_IMESSAGE_UNIVERSAL_IDENTIFIER,
  pageLayoutUniversalIdentifier:
    STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.personRecordPage
      .universalIdentifier,
  title: 'iMessage',
  position: 1000,
  icon: 'IconMessageCircle',
  layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
  widgets: [
    {
      universalIdentifier: WIDGET_IMESSAGE_UNIVERSAL_IDENTIFIER,
      title: 'iMessage',
      type: 'FRONT_COMPONENT',
      heightBehavior: 'TAB_VIEWPORT',
      configuration: {
        configurationType: 'FRONT_COMPONENT',
        frontComponentUniversalIdentifier: FRONT_THREAD_UNIVERSAL_IDENTIFIER,
      },
    },
  ],
});
