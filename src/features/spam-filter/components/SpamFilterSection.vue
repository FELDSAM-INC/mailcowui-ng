<script setup lang="ts">
// The "Spam filter" section of the domain, alias domain and mailbox pages (UI 006 US5, legacy form
// map screen 6 and D9, D22): after the rate limit, in legacy tab order. A domain has legacy's
// `#dspamfilter` tab (`edit.spam_filter`): the Allowlist and the Denylist with its mailboxes'
// entries read-only. An alias domain gets the same lists (D22). A mailbox, for administrators and
// domain administrators, gets the user page's spam score and lists under `user.spamfilter`, with
// its domain's entries read-only, separated as legacy separates them. Administrators get the
// owner's History (list entries are recorded on their owner) and, for a mailbox, the spam score's.
// Reached with `#spam-filter` (links from elsewhere): the section loads after its page, so it
// scrolls itself into view and takes the focus once.
import { computed, nextTick, onMounted, useId } from 'vue'
import { useRoute } from 'vue-router'

import { useIdentityQuery } from '@/app/session/queries'
import { canSeeHistory } from '@/features/quarantine'
import { lt } from '@/i18n'
import HistoryLink from '@/shared/components/HistoryLink.vue'

import { SECTION_TITLE_KEY, SPAM_FILTER_HASH, type PolicyOwnerKind } from '../owner'
import PolicyListsPanel from './PolicyListsPanel.vue'
import SpamScorePanel from './SpamScorePanel.vue'

const props = defineProps<{ kind: PolicyOwnerKind; owner: string }>()
const route = useRoute()
const identity = useIdentityQuery()
const history = computed(() => canSeeHistory(identity.data.value))
const policyOwner = computed(() => ({ kind: props.kind, name: props.owner }))
const headingId = `section-spam-filter-${useId()}-title`

onMounted(() => {
  if (route.hash !== SPAM_FILTER_HASH) return
  void nextTick(() => {
    document.getElementById('spam-filter')?.scrollIntoView({ block: 'start' })
    document.getElementById(headingId)?.focus()
  })
})
</script>

<template>
  <section
    id="spam-filter"
    data-spam-filter-section
    :aria-labelledby="headingId"
    class="scroll-mt-20 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
  >
    <div class="flex flex-wrap items-center gap-2">
      <h2
        :id="headingId"
        tabindex="-1"
        class="me-auto text-lg font-semibold text-gray-900 focus:outline-none dark:text-white"
      >
        {{ lt(SECTION_TITLE_KEY[kind]) }}
      </h2>
      <HistoryLink v-if="history" :target-type="kind" :target-id="owner" />
    </div>
    <div class="mt-4 flex flex-col gap-6">
      <template v-if="kind === 'mailbox'">
        <SpamScorePanel :mailbox="owner" :heading-level="3" :history="history" />
        <hr class="border-gray-200 dark:border-gray-800" />
      </template>
      <PolicyListsPanel :owner="policyOwner" :heading-level="3" />
    </div>
  </section>
</template>
