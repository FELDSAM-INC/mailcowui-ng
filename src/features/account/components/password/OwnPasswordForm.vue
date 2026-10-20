<script setup lang="ts">
// The own password (UI 005 US1, FR-021 to FR-028, research R7; legacy `#pwChangeModal`, decisions
// D7 and D9): legacy's field order (the new password with "generate", the haveibeenpwned check and
// the policy, its confirmation, then the current password with the app-password hint), "Sign out
// my other sessions" (ticked) and "Change password". The request carries passwords, so it runs
// through `useSecretRequest`, never a query cache. A success clears the fields and shows legacy's
// message for the role, then how many other sessions ended, that the app passwords keep working
// and how long mail apps may still accept the old password. A wrong current password is shown on
// its field, which is cleared and focused; ten of them start the server's countdown. Leaving with
// typed input asks first.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, nextTick, ref, shallowRef, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf, type Identity, type OwnPasswordChangeResult } from '@/api'
import { lt } from '@/i18n'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import NewPasswordFields from '@/shared/components/password/NewPasswordFields.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { useThrottle } from '@/shared/composables/useThrottle'
import { EyeIcon, EyeOffIcon } from '@/shared/icons'
import { rulesOfViolation, type PolicyRuleId } from '@/shared/password/policy-rules'
import { buttonVariants } from '@/shared/ui/button'

import { afterOwnPasswordChange, changeOwnPassword, useOwnPasswordPolicy } from '../../api/password'

const props = defineProps<{
  identity: Identity
  /** Active app passwords of a mailbox user (overview), for legacy's hint. */
  activeAppPasswords?: number | null
}>()

const { t } = useI18n()
const queryClient = useQueryClient()
const policyQuery = useOwnPasswordPolicy()
const id = useId()
const currentId = `${id}-current`
const newId = `own-${id}-new-password`

const password = ref('')
const password2 = ref('')
const current = ref('')
const currentShown = ref(false)
const endOtherSessions = ref(true)
const fields = ref<{ validate(): boolean; reset(): void } | null>(null)
const currentInput = ref<HTMLInputElement | null>(null)
const result = shallowRef<{ value: OwnPasswordChangeResult; endOthers: boolean } | null>(null)

const request = useSecretRequest(changeOwnPassword)
const throttle = useThrottle({ endedKey: 'account.password.throttleEnded' })
const form = useProblemForm({
  fieldId: (path) =>
    path === 'currentPassword' ? currentId : path === 'newPassword' ? newId : null,
  problemFields: { 'current-password-incorrect': 'currentPassword' },
  formKey: 'account.password.form',
})

const policy = computed(() => {
  const value = policyQuery.data.value
  if (!value) return null
  const { etag: _etag, ...rules } = value
  return rules
})
const failedRules = computed<PolicyRuleId[]>(() =>
  (form.problem.value?.fieldErrors.get('newPassword') ?? []).flatMap(rulesOfViolation),
)
const isMailbox = computed(() => props.identity.role === 'mailboxUser')
const hint = computed(() =>
  isMailbox.value && (props.activeAppPasswords ?? 0) > 0 ? props.activeAppPasswords! : null,
)
const dirty = computed(
  () => password.value !== '' || password2.value !== '' || current.value !== '',
)
useLeaveGuard(dirty, 'leaveGuard.body')

/** Legacy's message of a successful change of the own account, by role. */
const successMessage = computed(() => {
  if (props.identity.role === 'admin') return lt('success.admin_modified')
  if (props.identity.role === 'domainAdmin') {
    return lt('success.domain_admin_modified', props.identity.username)
  }
  return lt('success.mailbox_modified', props.identity.username)
})

function minutes(seconds: number): number {
  return Math.ceil(seconds / 60)
}

async function submit() {
  if (request.pending.value || throttle.active.value) return
  result.value = null
  const errors: Record<string, string[]> = {}
  if (!password.value) errors.newPassword = ['validation.required']
  if (!current.value) errors.currentPassword = ['validation.required']
  const match = fields.value?.validate() ?? password.value === password2.value
  if (Object.keys(errors).length > 0) {
    await form.setClientErrors(errors)
    return
  }
  if (!match) {
    form.clear()
    announce(lt('danger.password_mismatch'), { assertive: true })
    document.getElementById(`own-${id}-new-password2`)?.focus()
    return
  }
  form.clear()
  const endOthers = endOtherSessions.value
  const value = await request.run({
    currentPassword: current.value,
    newPassword: password.value,
    endOtherSessions: endOthers,
  })
  if (value) {
    password.value = ''
    password2.value = ''
    current.value = ''
    fields.value?.reset()
    result.value = { value, endOthers }
    afterOwnPasswordChange(queryClient)
    await nextTick()
    announce(lines.value.join(' '))
    return
  }
  const problem = request.problem.value
  if (!problem) return
  if (problem.is('too-many-requests')) {
    current.value = ''
    throttle.start(problem.retryAfter)
    return
  }
  if (problem.is('current-password-incorrect')) current.value = ''
  await form.setProblem(problem)
}

const lines = computed(() => {
  const outcome = result.value
  if (!outcome) return []
  const items = [successMessage.value]
  if (outcome.endOthers) {
    items.push(
      t(
        'account.password.result.sessionsEnded',
        { count: outcome.value.sessionsEnded },
        outcome.value.sessionsEnded,
      ),
    )
  }
  if (isMailbox.value && outcome.value.activeAppPasswords > 0) {
    items.push(lt('user.change_password_hint_app_passwords', outcome.value.activeAppPasswords))
  }
  if (outcome.value.mailServerCacheSeconds > 0) {
    const count = minutes(outcome.value.mailServerCacheSeconds)
    items.push(t('account.password.result.mailServerCache', { count }, count))
  }
  return items
})

defineExpose({ submit })
</script>

<template>
  <form class="flex flex-col gap-4" novalidate data-own-password @submit.prevent="submit">
    <ErrorSummary :id="form.summaryId" :items="form.summary.value" />
    <p
      v-if="policyQuery.isPending.value"
      data-password-policy-loading
      role="status"
      aria-busy="true"
      class="text-sm text-gray-700 dark:text-gray-300"
    >
      {{ lt('footer.loading') }}
    </p>
    <ProblemMessage
      v-else-if="policyQuery.isError.value"
      :problem="problemOf(policyQuery.error.value)"
      retry
      @retry="policyQuery.refetch()"
    />
    <div
      v-if="result"
      role="status"
      data-password-changed
      class="flex flex-col gap-1 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100"
    >
      <p v-for="(line, index) in lines" :key="index">{{ line }}</p>
    </div>
    <NewPasswordFields
      ref="fields"
      v-model:password="password"
      v-model:password2="password2"
      :id-prefix="`own-${id}`"
      :policy="policy"
      :username="identity.username"
      label-key="user.new_password"
      repeat-key="user.new_password_repeat"
      generate-key="user.generate"
      hibp
      :errors="form.errorsFor('newPassword')"
      :failed-rules="failedRules"
    />
    <hr class="border-gray-200 dark:border-gray-800" />
    <FormField
      :id="currentId"
      :label="lt('user.password_now')"
      :errors="form.errorsFor('currentPassword')"
    >
      <template #default="control">
        <div class="relative">
          <input
            v-bind="control"
            ref="currentInput"
            v-model="current"
            :type="currentShown ? 'text' : 'password'"
            autocomplete="current-password"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            maxlength="4096"
            class="form-control pe-12"
          />
          <button
            type="button"
            class="absolute inset-y-0 end-0 inline-flex size-11 items-center justify-center rounded-e-[10px] text-gray-600 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:text-white"
            :aria-label="t('auth.signIn.showPassword')"
            :aria-pressed="currentShown ? 'true' : 'false'"
            :aria-controls="currentId"
            @click="currentShown = !currentShown"
          >
            <EyeOffIcon v-if="currentShown" class="size-5" />
            <EyeIcon v-else class="size-5" />
          </button>
        </div>
      </template>
    </FormField>
    <LegacyText
      v-if="hint !== null"
      k="user.change_password_hint_app_passwords"
      :args="[hint]"
      as="p"
      data-app-password-hint
      class="text-sm text-gray-600 dark:text-gray-400"
    />
    <label class="flex min-h-11 items-center gap-3 text-sm text-gray-800 dark:text-gray-200">
      <input v-model="endOtherSessions" type="checkbox" class="size-5" data-end-other-sessions />
      {{ t('account.password.endOtherSessions') }}
    </label>
    <ProblemMessage :problem="form.formProblem.value" />
    <p v-if="throttle.active.value" role="status" class="text-sm text-gray-700 dark:text-gray-300">
      {{ t('auth.signIn.throttle.countdown', { time: throttle.clock.value }) }}
    </p>
    <button
      type="submit"
      :class="buttonVariants({ class: 'w-full sm:w-auto sm:self-start' })"
      :disabled="request.pending.value || throttle.active.value"
      :aria-busy="request.pending.value ? 'true' : 'false'"
    >
      {{ lt('user.change_password') }}
    </button>
  </form>
</template>
