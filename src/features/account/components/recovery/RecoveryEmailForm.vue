<script setup lang="ts">
// The recovery address (UI 005 US3, FR-032, FR-033, FR-016; legacy `#pwRecoveryEmailModal`,
// decision D15): `user.email` prefilled with the stored address, legacy's help, the current
// password and "Save changes". An empty field removes the address, as in legacy. The request carries
// the password, so it runs through `useSecretRequest`. An outdated version keeps the typed address
// (never the password), reloads the stored one and says it changed elsewhere.
import { useQueryClient } from '@tanstack/vue-query'
import { ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { OwnRecoveryEmail } from '@/api'
import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { buttonVariants } from '@/shared/ui/button'

import { afterRecoveryEmailChange, replaceOwnRecoveryEmail } from '../../api/recovery-email'

const props = defineProps<{ stored: OwnRecoveryEmail; username: string }>()
const emit = defineEmits<{ reload: [] }>()

const { t } = useI18n()
const queryClient = useQueryClient()
const id = useId()
const ids = { address: `${id}-address`, password: `${id}-password` }
const address = ref(props.stored.address ?? '')
const password = ref('')
const errors = ref<{ address?: string; password?: string }>({})
const outdated = ref(false)
const saved = ref(false)
const request = useSecretRequest(replaceOwnRecoveryEmail)

watch(
  () => props.stored.etag,
  () => {
    if (!outdated.value) address.value = props.stored.address ?? ''
  },
)
useLeaveGuard(
  () => address.value !== (props.stored.address ?? '') || password.value !== '',
  'leaveGuard.body',
)

async function submit() {
  if (request.pending.value) return
  saved.value = false
  const value = address.value.trim()
  const next: typeof errors.value = {}
  if (value !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    next.address = t('validation.format.email')
  }
  if (!password.value) next.password = t('validation.required')
  errors.value = next
  const first = (['address', 'password'] as const).find((key) => next[key])
  if (first) {
    document.getElementById(ids[first])?.focus()
    announce(next[first]!, { assertive: true })
    return
  }
  const result = await request.run(
    { address: value === '' ? null : value, currentPassword: password.value },
    props.stored.etag,
  )
  password.value = ''
  if (result) {
    outdated.value = false
    afterRecoveryEmailChange(queryClient, result)
    address.value = result.address ?? ''
    saved.value = true
    announce(lt('success.mailbox_modified', props.username))
    return
  }
  const problem = request.problem.value
  if (problem?.status === 412) {
    outdated.value = true
    emit('reload')
    announce(t('sections.outdated.title'), { assertive: true })
  } else if (problem?.is('current-password-incorrect')) {
    errors.value = { password: lt('danger.access_denied') }
    document.getElementById(ids.password)?.focus()
  } else if (problem?.fieldErrors.has('address')) {
    errors.value = { address: t('validation.format.email') }
    document.getElementById(ids.address)?.focus()
  }
}
</script>

<template>
  <form class="flex flex-col gap-4" novalidate data-recovery-email @submit.prevent="submit">
    <p
      v-if="saved"
      role="status"
      class="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100"
    >
      {{ lt('success.mailbox_modified', username) }}
    </p>
    <div
      v-if="outdated"
      role="alert"
      data-outdated
      class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      <p class="font-medium">{{ t('sections.outdated.title') }}</p>
      <p>
        {{
          t('sections.outdated.savedAs', { field: lt('user.email'), value: stored.address ?? '–' })
        }}
      </p>
    </div>
    <FormField
      :id="ids.address"
      :label="lt('user.email')"
      :errors="errors.address ? [errors.address] : []"
    >
      <template #default="control">
        <input
          v-bind="control"
          v-model="address"
          type="email"
          autocomplete="email"
          autocapitalize="none"
          spellcheck="false"
          maxlength="255"
          class="form-control"
        />
      </template>
    </FormField>
    <LegacyText
      k="user.password_reset_info"
      as="p"
      class="text-sm text-gray-700 dark:text-gray-300"
    />
    <FormField
      :id="ids.password"
      :label="lt('user.password_now')"
      :errors="errors.password ? [errors.password] : []"
    >
      <template #default="control">
        <input
          v-bind="control"
          v-model="password"
          type="password"
          autocomplete="current-password"
          maxlength="4096"
          class="form-control"
        />
      </template>
    </FormField>
    <ProblemMessage
      v-if="
        request.problem.value &&
        request.problem.value.status !== 412 &&
        !errors.password &&
        !errors.address
      "
      :problem="request.problem.value"
    />
    <button
      type="submit"
      :class="buttonVariants({ class: 'w-full sm:w-auto sm:self-start' })"
      :aria-disabled="request.pending.value"
      :aria-busy="request.pending.value ? 'true' : 'false'"
    >
      {{ lt('user.save') }}
    </button>
  </form>
</template>
