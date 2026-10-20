<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DomainAdmin, DomainAdminPermissions } from '@/api'
import { lt, resolveText } from '@/i18n'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import type { SectionChange, SectionStatus } from '@/shared/components/editable-section'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'
import { fetchAccount, updateAccount } from '../api'
import { changedFlags, permissionLabels, permissionOrder } from '../permissions'
import PermissionsEditor from './PermissionsEditor.vue'
const props = defineProps<{
  account: DomainAdmin
  editing: boolean
  editable: boolean
  editDisabledReason?: string | null
}>()
const emit = defineEmits<{
  edit: []
  cancel: []
  saved: [item: DomainAdmin]
  dirty: [value: boolean]
}>()
let disposed = false
onScopeDispose(() => {
  disposed = true
})
const { t } = useI18n(),
  client = useQueryClient()
const baseline = shallowRef(props.account),
  version = shallowRef(props.account),
  flags = ref<DomainAdminPermissions>({ ...props.account.permissions })
const changes = ref<SectionChange[] | null>(null),
  status = shallowRef<SectionStatus | null>(null)
const save = useVersionedSave({
  current: () => version.value,
  refetch: async () => {
    const item = (await fetchAccount('domainAdmin', props.account.username)) as DomainAdmin
    version.value = item
    return item
  },
})
const dirty = computed(
  () =>
    props.editing && Object.keys(changedFlags(baseline.value.permissions, flags.value)).length > 0,
)
watch([dirty, save.pending], () => emit('dirty', dirty.value || save.pending.value), {
  immediate: true,
})
const problems = useProblemForm({
  formKey: 'accounts.form',
  fieldId: (path) =>
    path.startsWith('permissions.') ? `account-permission-${path.split('.')[1]}` : null,
})
function reset() {
  baseline.value = props.account
  version.value = props.account
  flags.value = { ...props.account.permissions }
  changes.value = null
  problems.clear()
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
async function submit() {
  if (!props.editable || save.pending.value) return
  const permissions = changedFlags(baseline.value.permissions, flags.value)
  if (!Object.keys(permissions).length) {
    emit('cancel')
    return
  }
  problems.clear()
  const result = await save.save(permissions, (value, etag) =>
    updateAccount(client, 'domainAdmin', baseline.value.username, { permissions: value }, etag),
  )
  if (disposed) return
  if (result.status === 'failed') {
    await problems.setProblem(result.problem)
    return
  }
  if (result.status === 'outdated') {
    changes.value = result.latest
      ? permissionOrder
          .filter((name) => baseline.value.permissions[name] !== result.latest!.permissions[name])
          .map((name) => ({
            field: name,
            label: resolveText(permissionLabels[name], t),
            saved: lt(result.latest!.permissions[name] ? 'mailbox.active' : 'mailbox.inactive'),
          }))
      : []
    if (!changes.value.length)
      changes.value = [
        { field: 'version', label: lt('edit.username'), saved: version.value.username },
      ]
    return
  }
  if (result.status !== 'saved') return
  baseline.value = result.result as DomainAdmin
  version.value = baseline.value
  flags.value = { ...baseline.value.permissions }
  changes.value = null
  status.value = { kind: 'success', message: lt('success.acl_saved', baseline.value.username) }
  emit('dirty', false)
  emit('saved', baseline.value)
}
function discard() {
  const value = save.discard()
  if (value) {
    baseline.value = value
    version.value = value
    flags.value = { ...value.permissions }
  }
  changes.value = null
  problems.clear()
}
</script>
<template>
  <EditableSection
    section-id="permissions"
    :title="t('administrators.permissions.title')"
    :editable="editable"
    :editing="editing"
    :edit-disabled-reason="editDisabledReason"
    :saving="save.pending.value"
    :outdated="changes"
    :status="status"
    :save-label="lt('admin.save')"
    @edit="emit('edit')"
    @cancel="emit('cancel')"
    @save="submit"
    @save-again="submit"
    @discard="discard"
  >
    <dl class="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-[1fr_auto]">
      <template v-for="name in permissionOrder" :key="name"
        ><dt>{{ resolveText(permissionLabels[name], t) }}</dt>
        <dd>
          {{ lt(account.permissions[name] ? 'mailbox.active' : 'mailbox.inactive') }}
        </dd></template
      >
    </dl>
    <template #form
      ><ErrorSummary :id="problems.summaryId" :items="problems.summary.value" /><ProblemMessage
        :problem="problems.formProblem.value" />
      <fieldset :disabled="save.pending.value || !editable">
        <legend class="sr-only">{{ t('administrators.permissions.title') }}</legend>
        <PermissionsEditor v-model="flags" id-prefix="account-permission" /></fieldset
    ></template>
  </EditableSection>
</template>
