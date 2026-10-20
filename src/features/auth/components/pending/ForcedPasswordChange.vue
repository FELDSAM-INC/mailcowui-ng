<script setup lang="ts">
// The forced password change on the pending-actions screen (UI 005 US1, FR-029 to FR-031, research
// R8; legacy `#ChangePWModal`, decision D8): the new password and its confirmation with the policy
// and the generator, no current password, and legacy's "Save changes". The request carries the
// password, so it runs through `useSecretRequest`. On success the parent reads the session again
// and continues with the next action or lands as after sign-in.
import { computed, ref, useId } from 'vue'

import { problemOf } from '@/api'
import { lt } from '@/i18n'
import { changeOwnPassword, useOwnPasswordPolicy } from '@/features/account'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import NewPasswordFields from '@/shared/components/password/NewPasswordFields.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { rulesOfViolation, type PolicyRuleId } from '@/shared/password/policy-rules'
import { buttonVariants } from '@/shared/ui/button'

const props = defineProps<{ username: string | null }>()
const emit = defineEmits<{ done: [] }>()

const id = useId()
const prefix = `forced-${id}`
const policyQuery = useOwnPasswordPolicy()
const password = ref('')
const password2 = ref('')
const fields = ref<{ validate(): boolean; reset(): void } | null>(null)
const request = useSecretRequest(changeOwnPassword)
const form = useProblemForm({
  fieldId: (path) => (path === 'newPassword' ? `${prefix}-new-password` : null),
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

async function submit() {
  if (request.pending.value) return
  if (!password.value) {
    await form.setClientErrors({ newPassword: ['validation.required'] })
    return
  }
  if (!(fields.value?.validate() ?? password.value === password2.value)) {
    form.clear()
    announce(lt('danger.password_mismatch'), { assertive: true })
    document.getElementById(`${prefix}-new-password2`)?.focus()
    return
  }
  form.clear()
  const value = await request.run({ newPassword: password.value, endOtherSessions: true })
  if (value) {
    password.value = ''
    password2.value = ''
    fields.value?.reset()
    announce(lt('success.password_changed_success'))
    emit('done')
    return
  }
  if (request.problem.value) await form.setProblem(request.problem.value)
}
</script>

<template>
  <form class="flex flex-col gap-4" novalidate data-forced-password @submit.prevent="submit">
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
    <NewPasswordFields
      ref="fields"
      v-model:password="password"
      v-model:password2="password2"
      :id-prefix="prefix"
      :policy="policy"
      :username="props.username"
      label-key="user.new_password"
      repeat-key="user.new_password_repeat"
      generate-key="user.generate"
      :errors="form.errorsFor('newPassword')"
      :failed-rules="failedRules"
    />
    <ProblemMessage :problem="form.formProblem.value" />
    <button
      type="submit"
      :class="buttonVariants({ class: 'w-full sm:w-auto sm:self-start' })"
      :disabled="request.pending.value"
      :aria-busy="request.pending.value ? 'true' : 'false'"
    >
      {{ lt('user.save_changes') }}
    </button>
  </form>
</template>
