// UI feature 006, the spam filter area (research R4): the spam score and the allow and block lists,
// on the mailbox user's Spam filter page and as the "Spam filter" section of the domain, alias
// domain and mailbox pages (legacy form map D9). Other code reaches it only through this file; it
// imports the quarantine area (capabilities, permissions) through its index only.
import { defineAsyncComponent } from 'vue'

import { loadFeatureMessages } from '@/i18n'

export { spamFilterRoutes } from './routes'
export { hostLocation as spamFilterLocation, SPAM_FILTER_HASH } from './owner'

/**
 * The "Spam filter" section of a host page (props `kind`: `domain`, `aliasDomain` or `mailbox`,
 * and `owner`: its name), with `id="spam-filter"`. Lazy, and loaded with the 006 strings, so the
 * host page's chunk does not grow with it.
 */
export const SpamFilterSection = defineAsyncComponent(() =>
  Promise.all([
    import('./components/SpamFilterSection.vue'),
    loadFeatureMessages('quarantine'),
  ]).then(([module]) => module),
)
