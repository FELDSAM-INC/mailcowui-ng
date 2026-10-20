<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { onScopeDispose, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { problemOf, type ApiProblem } from '@/api'
import { lt } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { confirm } from '@/shared/composables/useConfirm'
import { buttonVariants } from '@/shared/ui/button'
import { resetActiveSyncCache, resetGroupwareProfile } from '../../api/groupware'

const props = defineProps<{
  mailbox: string
  enabled: boolean
  activeSync: boolean
  profile: boolean
}>()
const client = useQueryClient()
const { t } = useI18n()
const pending = ref(false)
const notice = ref('')
const problem = shallowRef<ApiProblem | null>(null)
let disposed = false
onScopeDispose(() => {
  disposed = true
})
async function reset(profile: boolean, trigger?: HTMLElement) {
  if (pending.value || !props.enabled || !(profile ? props.profile : props.activeSync)) return
  const mailbox = props.mailbox
  const key = profile ? 'user.sogo_profile_reset' : 'user.eas_reset'
  // Safari does not focus a tapped button. Give the confirmation host an explicit return target.
  trigger?.focus()
  if (
    !(await confirm({
      title: lt('footer.confirm_delete'),
      description: `${lt(key)}?\n${mailbox}`,
      confirmLabel: lt('footer.delete_now'),
      destructive: true,
      ...(profile
        ? {
            acknowledge: { label: t('account.devices.sogoAcknowledge') },
            content: {
              component: LegacyText,
              props: { k: 'user.sogo_profile_reset_help', as: 'p' },
            },
          }
        : {}),
    }))
  )
    return
  if (
    disposed ||
    props.mailbox !== mailbox ||
    !props.enabled ||
    !(profile ? props.profile : props.activeSync)
  )
    return
  pending.value = true
  notice.value = ''
  problem.value = null
  try {
    await (profile ? resetGroupwareProfile : resetActiveSyncCache)(client, mailbox)
    if (disposed || props.mailbox !== mailbox) return
    notice.value = lt(profile ? 'success.sogo_profile_reset' : 'success.eas_reset', mailbox)
    announce(notice.value)
  } catch (error) {
    if (!disposed && props.mailbox === mailbox) problem.value = problemOf(error)
  } finally {
    if (!disposed) pending.value = false
  }
}
</script>

<template>
  <div
    v-if="enabled && (activeSync || profile)"
    class="flex flex-col gap-6 border-t border-gray-200 pt-6 dark:border-gray-700"
    :aria-busy="pending"
  >
    <section
      v-if="activeSync"
      aria-labelledby="eas-reset-title"
      class="flex flex-col items-start gap-3"
    >
      <LegacyText id="eas-reset-title" k="user.eas_reset" as="h2" class="text-lg font-semibold" />
      <LegacyText k="user.eas_reset_help" as="div" />
      <button
        type="button"
        data-reset-activesync
        :class="buttonVariants({ variant: 'outline' })"
        :aria-disabled="pending"
        class="aria-disabled:pointer-events-none aria-disabled:opacity-60"
        @click="reset(false, $event.currentTarget as HTMLElement)"
      >
        {{ lt('user.eas_reset_now') }}
      </button>
    </section>
    <section
      v-if="profile"
      aria-labelledby="sogo-reset-title"
      class="flex flex-col items-start gap-3"
    >
      <LegacyText
        id="sogo-reset-title"
        k="user.sogo_profile_reset"
        as="h2"
        class="text-lg font-semibold"
      />
      <LegacyText k="user.sogo_profile_reset_help" as="div" />
      <button
        type="button"
        data-reset-groupware
        :class="buttonVariants({ variant: 'outline' })"
        :aria-disabled="pending"
        class="aria-disabled:pointer-events-none aria-disabled:opacity-60"
        @click="reset(true, $event.currentTarget as HTMLElement)"
      >
        {{ lt('user.sogo_profile_reset_now') }}
      </button>
    </section>
    <p v-if="notice" role="status">{{ notice }}</p>
    <ProblemMessage :problem="problem" />
  </div>
</template>
