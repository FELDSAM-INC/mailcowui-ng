<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiProblem, type DomainAdmin } from '@/api'
import { useBranding } from '@/app/branding/public-config'
import { lt } from '@/i18n'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import type { SectionChange, SectionStatus } from '@/shared/components/editable-section'
import { useClientErrors } from '@/shared/composables/useClientErrors'
import { useConfirm } from '@/shared/composables/useConfirm'
import { usePasswordPolicy } from '@/shared/composables/usePasswordPolicy'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { changedSince, useVersionedSave } from '@/shared/composables/useVersionedSave'
import { buttonVariants } from '@/shared/ui/button'
import {
  accountKeys,
  fetchAccount,
  rememberAccount,
  updateAccount,
  updateAccountWithPassword,
  useAccountCapabilities,
  type AccountRole,
  type ManagedAccount,
} from '../api'
import { changedAccountFields, formFromAccount, validateAccountForm } from '../account-form'
import { confirmAccountChange } from '../confirmations'
import AccountFields from './AccountFields.vue'
import SecondFactorStatusBadge from './SecondFactorStatusBadge.vue'
import DomainAssignmentList from './DomainAssignmentList.vue'
const props = defineProps<{
  account: ManagedAccount
  role: AccountRole
  editing: boolean
  editable: boolean
  own?: boolean
  lastActive?: boolean
  editDisabledReason?: string | null
}>()
const emit = defineEmits<{
  edit: []
  cancel: []
  saved: [item: ManagedAccount, previous: ManagedAccount]
  dirty: [value: boolean]
  suspend: []
}>()
const { t } = useI18n(),
  client = useQueryClient(),
  confirm = useConfirm()
const policy = usePasswordPolicy(),
  caps = useAccountCapabilities(),
  { branding } = useBranding()
const form = ref(formFromAccount(props.account)),
  original = shallowRef(props.account),
  version = shallowRef(props.account)
const submittedDomains = ref<string[]>([])
const domainLabels = computed(() =>
  'domains' in props.account
    ? Object.fromEntries(props.account.domains.map((item) => [item.domain, item.domainUnicode]))
    : {},
)
const status = shallowRef<SectionStatus | null>(null),
  changes = ref<SectionChange[] | null>(null)
const request = useSecretRequest(updateAccountWithPassword),
  translate = useClientErrors()
const save = useVersionedSave({
  current: () => version.value,
  refetch: async () => {
    const value = await fetchAccount(props.role, original.value.username)
    version.value = value
    return value
  },
})
let generation = 0,
  disposed = false
const dirty = computed(
  () =>
    props.editing &&
    (Object.keys(changedAccountFields(original.value, form.value)).length > 0 ||
      !!form.value.password ||
      !!form.value.password2),
)
watch([dirty, save.pending], () => emit('dirty', dirty.value || save.pending.value), {
  immediate: true,
})
function reset() {
  generation++
  original.value = props.account
  version.value = props.account
  form.value = formFromAccount(props.account)
  changes.value = null
  problems.clear()
  request.clear()
  save.discard()
}
watch(
  () => props.editing,
  () => {
    reset()
    if (props.editing) status.value = null
  },
)
watch(() => props.account.username, reset)
onScopeDispose(() => {
  disposed = true
  form.value.password = ''
  form.value.password2 = ''
})
const problems = useProblemForm({
  formKey: 'accounts.form',
  fieldId: (path) =>
    path.startsWith('domains')
      ? domainErrorField(path)
      : path === 'password'
        ? 'account-edit-new-password'
        : path === 'password2'
          ? 'account-edit-new-password2'
          : path === 'username'
            ? 'account-edit-username'
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
    ? `account-edit-domains-chip-${encodeURIComponent(name)}`
    : 'account-edit-domains'
}
function errors(path: string) {
  return path === 'domains'
    ? problems.summary.value
        .filter((item) => item.path.startsWith('domains'))
        .flatMap((item) => item.messages)
    : problems.errorsFor(path)
}
const activeReason = computed(() =>
  props.lastActive && props.account.active ? lt('warning.no_active_admin') : null,
)
async function submit() {
  if (!props.editable || save.pending.value) return
  submittedDomains.value = [...form.value.domains]
  const invalid = validateAccountForm(
    form.value,
    props.role,
    false,
    caps.data.value?.usernameMaxLength ?? 255,
    original.value,
  )
  if (Object.keys(invalid).length) {
    await problems.setClientMessages(translate(invalid))
    return
  }
  const patch = changedAccountFields(original.value, form.value),
    current = generation,
    role = props.role,
    username = original.value.username
  if (patch.active === false && activeReason.value) return
  if (!(await confirmAccountChange(confirm, t, original.value, patch, !!props.own))) return
  if (!props.editable || save.pending.value || disposed || current !== generation) return
  if (!Object.keys(patch).length && !form.value.password) {
    emit('cancel')
    return
  }
  problems.clear()
  status.value = null
  const password = form.value.password
  const result = await save.save(patch, async (value, etag) => {
    if (!password) return updateAccount(client, role, username, value, etag)
    const saved = await request.run(role, username, { ...value, password }, etag)
    if (!saved) throw request.problem.value ?? ApiProblem.fromParts({ kind: 'network' })
    return saved
  })
  if (disposed || generation !== current) {
    void client.invalidateQueries({ queryKey: accountKeys(role).lists() })
    return
  }
  if (result.status === 'failed') {
    await problems.setProblem(result.problem)
    return
  }
  if (result.status === 'outdated') {
    if (result.latest) {
      const base = formFromAccount(original.value),
        latest = formFromAccount(result.latest)
      changes.value = changedSince(base, latest, [
        'username',
        'domains',
        'active',
        'forcePasswordChange',
        'forceSecondFactorSetup',
      ]).map(({ field, savedValue }) => ({
        field,
        label:
          field === 'username'
            ? lt('edit.username')
            : field === 'domains'
              ? lt('edit.domains')
              : field === 'active'
                ? lt('edit.active')
                : field === 'forcePasswordChange'
                  ? lt('edit.force_pw_update')
                  : lt('tfa.force_tfa'),
        saved:
          typeof savedValue === 'boolean'
            ? lt(savedValue ? 'mailbox.active' : 'mailbox.inactive')
            : Array.isArray(savedValue)
              ? savedValue.join(', ')
              : savedValue,
      }))
    }
    if (!changes.value?.length)
      changes.value = [
        { field: 'version', label: lt('edit.username'), saved: version.value.username },
      ]
    return
  }
  if (result.status !== 'saved') return
  form.value.password = ''
  form.value.password2 = ''
  request.clear()
  rememberAccount(client, role, result.result, username)
  const previous = original.value
  original.value = result.result
  version.value = result.result
  form.value = formFromAccount(result.result)
  changes.value = null
  status.value = {
    kind: 'success',
    message:
      role === 'admin'
        ? lt('success.admin_modified')
        : lt('success.domain_admin_modified', result.result.username),
  }
  emit('dirty', false)
  emit('saved', result.result, previous)
}
function discard() {
  const value = save.discard()
  if (value) {
    original.value = value
    version.value = value
    form.value = formFromAccount(value)
  }
  changes.value = null
  problems.clear()
  request.clear()
}
</script>
<template>
  <EditableSection
    section-id="account"
    :title="role === 'admin' ? lt('edit.admin') : lt('edit.domain_admin')"
    :editable="editable"
    :editing="editing"
    :edit-disabled-reason="editDisabledReason"
    :saving="save.pending.value"
    :status="status"
    :outdated="changes"
    :save-label="lt('edit.save')"
    @edit="emit('edit')"
    @cancel="emit('cancel')"
    @save="submit"
    @save-again="submit"
    @discard="discard"
  >
    <dl class="grid gap-3 text-sm sm:grid-cols-[auto_1fr]">
      <dt>{{ lt('edit.username') }}</dt>
      <dd class="wrap-anywhere">{{ account.username }}</dd>
      <template v-if="'domains' in account"
        ><dt>{{ lt('edit.domains') }}</dt>
        <dd>
          <DomainAssignmentList
            :assignments="(account as DomainAdmin).domains"
            :account-active="account.active"
          /></dd
      ></template>
      <dt>{{ lt('edit.active') }}</dt>
      <dd>{{ lt(account.active ? 'mailbox.active' : 'mailbox.inactive') }}</dd>
      <dt>{{ lt('tfa.tfa') }}</dt>
      <dd>
        <SecondFactorStatusBadge :status="account.secondFactorStatus" />
        <span class="text-gray-600 dark:text-gray-400">{{
          t('accounts.passkeys', { count: account.activePasskeyCount })
        }}</span>
      </dd>
      <dt>{{ lt('tfa.force_tfa') }}</dt>
      <dd>{{ lt(account.forceSecondFactorSetup ? 'mailbox.active' : 'mailbox.inactive') }}</dd>
      <dt>{{ lt('edit.force_pw_update') }}</dt>
      <dd>{{ lt(account.forcePasswordChange ? 'mailbox.active' : 'mailbox.inactive') }}</dd>
      <dt>{{ lt('mailbox.created_on') }}</dt>
      <dd>{{ new Date(account.createdAt).toLocaleString() }}</dd>
      <dt>{{ lt('mailbox.last_modified') }}</dt>
      <dd>{{ account.modifiedAt ? new Date(account.modifiedAt).toLocaleString() : '—' }}</dd>
    </dl>
    <template #form>
      <ErrorSummary :id="problems.summaryId" :items="problems.summary.value" />
      <ProblemMessage :problem="problems.formProblem.value" />
      <fieldset :disabled="save.pending.value || !editable" class="min-w-0">
        <legend class="sr-only">{{ lt('edit.username') }}</legend>
        <AccountFields
          v-model="form"
          :role="role"
          mode="edit"
          id-prefix="account-edit"
          :policy="policy.data.value"
          :product-name="branding.productName"
          :errors="errors"
          :domain-errors="domainErrors"
          :domain-labels="domainLabels"
          :active-disabled-reason="activeReason"
          :max-username-length="caps.data.value?.usernameMaxLength"
        >
          <template #suspension
            ><button
              type="button"
              :class="buttonVariants({ variant: 'outline' })"
              :disabled="account.secondFactorStatus !== 'active'"
              @click="emit('suspend')"
            >
              {{ lt('tfa.disable_tfa') }}
            </button></template
          >
        </AccountFields>
      </fieldset>
    </template>
  </EditableSection>
</template>
