<script setup lang="ts">
// UI013 FR-073/074/106, plan D8: retain the two classic fields. The server stores only a hash
// and confirms the restart; a timeout is not a success. Input never enters a draft or query cache.
import { computed, nextTick, onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { SettingsCapabilities } from '@/api'
import { lt } from '@/i18n'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { EyeIcon, EyeOffIcon } from '@/shared/icons'
import { safeHref } from '@/shared/security/safe-url'
import { buttonVariants } from '@/shared/ui/button'

import { setRspamdUiPassword } from '../../api/rspamd'

const props = defineProps<{ capabilities: SettingsCapabilities }>()
const { t } = useI18n()
const password = ref('')
const repeat = ref('')
const shown = ref(false)
const succeeded = ref(false)
const input = ref<HTMLInputElement | null>(null)
const href = computed(() => safeHref(props.capabilities.rspamdWebInterfaceUrl))
const request = useSecretRequest(setRspamdUiPassword)
const form = useProblemForm({
  fieldId: (path) =>
    path === 'password'
      ? 'rspamd-new-password'
      : path === 'password2'
        ? 'rspamd-new-password2'
        : null,
  formKey: 'systemSettings.rspamdUi.form',
})
const outcome = computed(() => {
  if (request.problem.value?.is('container-action-failed'))
    return t('systemSettings.rspamdUi.serviceFailure')
  if (request.problem.value?.is('outcome-unknown'))
    return t('systemSettings.rspamdUi.outcomeUnknown')
  return null
})
useLeaveGuard(
  computed(() => password.value !== '' || repeat.value !== '' || request.pending.value),
  'leaveGuard.body',
)

function clearPasswords() {
  password.value = ''
  repeat.value = ''
  shown.value = false
}
onScopeDispose(clearPasswords)

async function retry() {
  request.clear()
  form.clear()
  succeeded.value = false
  await nextTick()
  input.value?.focus()
}

async function submit() {
  if (request.pending.value) return
  succeeded.value = false
  request.clear()
  form.clear()
  const errors: Record<string, string[]> = {}
  const limits = props.capabilities.limits
  const length = Array.from(password.value).length
  if (length === 0) errors.password = [lt('danger.password_empty')]
  else if (length < limits.rspamdUiPasswordMinLength) {
    errors.password = [
      limits.rspamdUiPasswordMinLength === 6
        ? lt('danger.rspamd_ui_pw_length')
        : t('validation.tooShort', { min: limits.rspamdUiPasswordMinLength }),
    ]
  } else if (length > limits.rspamdUiPasswordMaxLength) {
    errors.password = [t('validation.tooLong', { max: limits.rspamdUiPasswordMaxLength })]
  } else if (/[\u0000-\u001f\u007f]/.test(password.value)) {
    errors.password = [t('validation.invalidFormat')]
  }
  if (password.value !== repeat.value) errors.password2 = [lt('danger.password_mismatch')]
  if (Object.keys(errors).length) {
    await form.setClientMessages(errors)
    return
  }
  try {
    const result = await request.run({ password: password.value })
    if (result) {
      succeeded.value = true
      announce(`${lt('success.rspamd_ui_pw_set')}. ${t('systemSettings.rspamdUi.restarted')}`)
    } else if (outcome.value) {
      announce(outcome.value, { assertive: true })
    } else if (request.problem.value) {
      await form.setProblem(request.problem.value)
    }
  } finally {
    clearPasswords()
  }
}
</script>

<template>
  <section class="flex min-w-0 flex-col gap-4" data-rspamd-settings>
    <RouterLink
      :to="{ name: 'system-settings' }"
      :class="buttonVariants({ variant: 'link', class: 'self-start' })"
      >{{ t('nav.system') }}</RouterLink
    >
    <PageHeader :title="t('nav.rspamdUi')">
      <template #actions><HistoryLink target-type="rspamdUiPassword" /></template>
    </PageHeader>
    <a
      v-if="href"
      :href="href"
      target="_blank"
      rel="noopener noreferrer"
      data-rspamd-link
      :class="buttonVariants({ variant: 'link', class: 'self-start' })"
      >{{ t('nav.rspamdUi') }}</a
    >
    <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <ErrorSummary :id="form.summaryId" :items="form.summary.value" />
      <div
        v-if="succeeded"
        role="status"
        data-rspamd-success
        class="rounded-xl border border-green-200 bg-green-50 p-4 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100"
      >
        <p>{{ lt('success.rspamd_ui_pw_set') }}</p>
        <p>{{ t('systemSettings.rspamdUi.restarted') }}</p>
      </div>
      <div
        v-if="outcome"
        role="alert"
        data-rspamd-outcome
        class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        <p>{{ outcome }}</p>
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline', class: 'mt-3' })"
          @click="retry"
        >
          {{ t('common.retry') }}
        </button>
      </div>
      <ProblemMessage v-else :problem="form.formProblem.value" retry @retry="retry" />
      <fieldset :disabled="request.pending.value" class="flex min-w-0 flex-col gap-4">
        <FormField
          id="rspamd-new-password"
          :label="lt('admin.password')"
          :errors="form.errorsFor('password')"
        >
          <template #default="control">
            <div class="relative">
              <input
                v-bind="control"
                ref="input"
                v-model="password"
                :type="shown ? 'text' : 'password'"
                name="password"
                autocomplete="new-password"
                autocapitalize="none"
                autocorrect="off"
                spellcheck="false"
                class="form-control pe-12"
              />
              <button
                type="button"
                class="absolute inset-y-0 end-0 inline-flex size-11 items-center justify-center rounded-e-[10px] text-gray-600 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:text-white"
                :aria-label="t('auth.signIn.showPassword')"
                :aria-pressed="shown ? 'true' : 'false'"
                aria-controls="rspamd-new-password rspamd-new-password2"
                @click="shown = !shown"
              >
                <EyeOffIcon v-if="shown" class="size-5" /><EyeIcon v-else class="size-5" />
              </button>
            </div>
          </template>
        </FormField>
        <FormField
          id="rspamd-new-password2"
          :label="lt('admin.password_repeat')"
          :errors="form.errorsFor('password2')"
        >
          <template #default="control"
            ><input
              v-bind="control"
              v-model="repeat"
              :type="shown ? 'text' : 'password'"
              name="password-repeat"
              autocomplete="new-password"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
              class="form-control"
          /></template>
        </FormField>
      </fieldset>
      <button
        type="submit"
        :class="buttonVariants({ class: 'w-full sm:w-auto sm:self-start' })"
        :disabled="request.pending.value"
        :aria-busy="request.pending.value ? 'true' : 'false'"
      >
        {{ lt('admin.save') }}
      </button>
    </form>
  </section>
</template>
