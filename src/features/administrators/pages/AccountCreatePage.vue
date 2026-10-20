<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { lt } from '@/i18n'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useClientErrors } from '@/shared/composables/useClientErrors'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { usePasswordPolicy } from '@/shared/composables/usePasswordPolicy'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { buttonVariants } from '@/shared/ui/button'
import {
  accountKeys,
  createAccount,
  rememberAccount,
  useAccountCapabilities,
  type AccountRole,
} from '../api'
import { formFromAccount, validateAccountForm } from '../account-form'
import AccountFields from '../components/AccountFields.vue'
import { setAccountFlash } from '../flash'
import { normaliseUsername } from '../username'
const props = defineProps<{ role: AccountRole }>()
const { t } = useI18n()
const router = useRouter(),
  client = useQueryClient()
const form = ref(formFromAccount())
const submittedDomains = ref<string[]>([])
const defaults = ref(formFromAccount())
const capabilities = useAccountCapabilities(),
  policy = usePasswordPolicy()
const request = useSecretRequest(createAccount)
const translate = useClientErrors()
const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(defaults.value))
const guard = useLeaveGuard(() => dirty.value || request.pending.value, 'leaveGuard.body')
let generation = 0,
  disposed = false
watch(
  () => props.role,
  () => {
    generation++
    form.value = formFromAccount()
    defaults.value = formFromAccount()
    request.clear()
    problems.clear()
  },
)
onScopeDispose(() => {
  disposed = true
  form.value.password = ''
  form.value.password2 = ''
})
watch(capabilities.data, (value) => {
  if (value && !dirty.value) {
    form.value = { ...form.value, ...value.newAccountDefaults }
    defaults.value = { ...form.value }
  }
})
const problems = useProblemForm({
  formKey: 'accounts.form',
  fieldId: (path) =>
    path.startsWith('domains')
      ? domainErrorField(path)
      : path === 'password'
        ? 'account-create-new-password'
        : path === 'password2'
          ? 'account-create-new-password2'
          : path === 'username'
            ? 'account-create-username'
            : null,
  valueAt: (path) =>
    path === 'username'
      ? form.value.username
      : path.startsWith('domains.')
        ? submittedDomains.value[Number(path.split('.')[1])]
        : undefined,
  problemFields: { 'account-exists': 'username' },
  problemParams: () => ({ username: form.value.username }),
})
const domainErrors = computed(() =>
  Object.fromEntries(
    submittedDomains.value.map((name, index) => [name, problems.errorsFor(`domains.${index}`)]),
  ),
)
function domainErrorField(path: string) {
  const name = submittedDomains.value[Number(path.split('.')[1])]
  return name && form.value.domains.includes(name)
    ? `account-create-domains-chip-${encodeURIComponent(name)}`
    : 'account-create-domains'
}
function errors(path: string): string[] {
  return path === 'domains'
    ? problems.summary.value
        .filter((entry) => entry.path.startsWith('domains'))
        .flatMap((entry) => entry.messages)
    : problems.errorsFor(path)
}
async function submit() {
  if (request.pending.value) return
  submittedDomains.value = [...form.value.domains]
  const invalid = validateAccountForm(
    form.value,
    props.role,
    true,
    capabilities.data.value?.usernameMaxLength ?? 255,
  )
  if (Object.keys(invalid).length) {
    await problems.setClientMessages(translate(invalid))
    return
  }
  problems.clear()
  const current = generation,
    role = props.role
  const body = {
    username: normaliseUsername(form.value.username),
    password: form.value.password,
    active: form.value.active,
    forcePasswordChange: form.value.forcePasswordChange,
    forceSecondFactorSetup: form.value.forceSecondFactorSetup,
    ...(role === 'domainAdmin' ? { domains: [...form.value.domains] } : {}),
  }
  const created = await request.run(role, body)
  if (disposed || current !== generation) {
    void client.invalidateQueries({ queryKey: accountKeys(role).lists() })
    return
  }
  if (!created) {
    await problems.setProblem(request.problem.value)
    return
  }
  form.value.password = ''
  form.value.password2 = ''
  request.clear()
  rememberAccount(client, role, created)
  setAccountFlash(
    created.username,
    role === 'admin'
      ? lt('success.admin_added', created.username)
      : lt('success.domain_admin_added', created.username),
  )
  guard.disarm()
  await router.push({
    name: role === 'admin' ? 'admin-detail' : 'domain-admin-detail',
    params: { username: created.username },
  })
}
</script>
<template>
  <section class="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <PageHeader :title="role === 'admin' ? lt('admin.add_admin') : lt('admin.add_domain_admin')" />
    <form
      class="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
      novalidate
      @submit.prevent="submit"
    >
      <ErrorSummary :id="problems.summaryId" :items="problems.summary.value" />
      <ProblemMessage
        :problem="problems.formProblem.value"
        :retry="problems.formProblem.value?.kind === 'network'"
        @retry="submit"
      />
      <fieldset :disabled="request.pending.value" class="min-w-0">
        <legend class="sr-only">
          {{ role === 'admin' ? lt('admin.admin') : lt('admin.domain_admin') }}
        </legend>
        <AccountFields
          v-model="form"
          :role="role"
          mode="create"
          id-prefix="account-create"
          :policy="policy.data.value"
          :errors="errors"
          :domain-errors="domainErrors"
          :max-username-length="capabilities.data.value?.usernameMaxLength"
        />
      </fieldset>
      <div
        class="sticky bottom-0 -mx-4 flex justify-end border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900"
      >
        <button
          type="submit"
          :class="buttonVariants({ variant: 'default' })"
          :disabled="request.pending.value"
        >
          {{ request.pending.value ? t('sections.saving') : lt('admin.add') }}
        </button>
      </div>
    </form>
  </section>
</template>
