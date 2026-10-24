<script setup lang="ts">
// The mailbox user's Spam filter page (UI 006 US4, FR-042 to FR-051; legacy form map screen 5:
// `templates/user/Spamfilter.twig`): legacy's title, the spam score under `user.spamfilter_behavior`
// and, after legacy's divider, the Allowlist and the Denylist of the own mailbox with the domain's
// entries read-only. The route is offered to mailbox users with `spamScore` or `spamPolicy` (the
// catalogue entry, as legacy shows the tab); each part without its flag is read-only with legacy's
// "Prohibited by ACL" note, as legacy disables its controls.
import { computed } from 'vue'

import { problemOf } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { lt } from '@/i18n'
import SettingsPage from '@/shared/components/SettingsPage.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'

import PolicyListsPanel from '../components/PolicyListsPanel.vue'
import SpamScorePanel from '../components/SpamScorePanel.vue'

const identity = useIdentityQuery()
const mailbox = computed(() => identity.data.value?.username ?? null)
const owner = computed(() => ({ kind: 'mailbox' as const, name: mailbox.value ?? '' }))
</script>

<template>
  <SettingsPage :title="lt('user.spamfilter')" unboxed data-spam-filter-page>
    <p
      v-if="!mailbox && identity.isPending.value"
      role="status"
      class="text-gray-600 dark:text-gray-400"
    >
      {{ lt('datatables.loadingRecords') }}
    </p>
    <ProblemMessage
      v-else-if="!mailbox"
      :problem="problemOf(identity.error.value)"
      retry
      @retry="identity.refetch()"
    />
    <div v-else class="flex min-w-0 flex-col gap-6">
      <SpamScorePanel class="surface" :mailbox="mailbox" :heading-level="2" />
      <PolicyListsPanel :owner="owner" :heading-level="2" />
    </div>
  </SettingsPage>
</template>
