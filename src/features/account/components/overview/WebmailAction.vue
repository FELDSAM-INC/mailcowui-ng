<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQueryClient } from '@tanstack/vue-query'

import { queryKeys } from '@/api'
import { useIdentityQuery, useSessionQuery } from '@/app/session/queries'
import { lt } from '@/i18n'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { ExternalLinkIcon } from '@/shared/icons'
import { Button, buttonVariants } from '@/shared/ui/button'

import { useWebmailHandOff } from '../../composables/useWebmailHandOff'

const props = defineProps<{ enabled: boolean }>()
const { t } = useI18n()
const identity = useIdentityQuery()
const session = useSessionQuery()
const queryClient = useQueryClient()
const allowed = computed(
  () =>
    props.enabled &&
    session.data.value?.state === 'active' &&
    session.data.value.pendingActions.length === 0 &&
    identity.data.value?.role === 'mailboxUser' &&
    !identity.data.value.impersonation &&
    identity.data.value.pendingActions.length === 0,
)
const action = useWebmailHandOff(
  allowed,
  () => identity.data.value?.username ?? '',
  () => {
    const mailbox = identity.data.value?.username
    if (mailbox)
      void queryClient.invalidateQueries({ queryKey: queryKeys.selfService.recentLogins(mailbox) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
  },
)
</script>

<template>
  <div v-if="allowed" class="flex flex-col items-start gap-3" data-webmail-action>
    <Button :disabled="action.pending.value" :aria-busy="action.pending.value" @click="action.open">
      {{ lt('user.open_webmail_sso') }}
      <ExternalLinkIcon class="size-4" />
    </Button>
    <div v-if="action.blockedUrl.value" role="status" class="flex flex-col items-start gap-2">
      <p>{{ t('account.webmail.blocked') }}</p>
      <a
        :href="action.blockedUrl.value"
        target="_blank"
        rel="noopener noreferrer"
        :class="buttonVariants({ variant: 'outline' })"
      >
        {{ lt('user.open_webmail_sso') }}
        <ExternalLinkIcon class="size-4" />
      </a>
    </div>
    <ProblemMessage :problem="action.problem.value" />
  </div>
</template>
