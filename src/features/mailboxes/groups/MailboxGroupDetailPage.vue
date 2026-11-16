<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { problemOf, queryKeys } from '@/api'
import { lt } from '@/i18n'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { confirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'
import { buttonVariants } from '@/shared/ui/button'
import MailboxStatusBadge from '../components/display/MailboxStatusBadge.vue'
import {
  deleteGroup,
  fetchGroup,
  groupDetailKey,
  groupKey,
  groupOptions,
  updateGroup,
  type MailboxGroup,
} from './api'
import { setDeletionWarnings } from './flash'
import { groupFieldId, groupForm, groupPatch, type GroupForm } from './form'
import GroupFormFields from './GroupFormFields.vue'
import GroupOverview from './GroupOverview.vue'
import GroupWarnings from './GroupWarnings.vue'
const { t } = useI18n()
const route = useRoute(),
  router = useRouter(),
  client = useQueryClient()
const id = computed(() => Number(route.params.groupId))
const form = ref<GroupForm>(),
  actionBusy = ref(false)
const query = useQuery(
  computed(() => ({
    ...groupOptions(id.value),
    refetchInterval: (q: { state: { data?: MailboxGroup } }) =>
      !form.value &&
      q.state.data &&
      [...q.state.data.imapGrants, ...q.state.data.sogoGrants].some((g) => g.state !== 'applied')
        ? 15_000
        : false,
  })),
)
const stored = computed(() => query.data.value)
const base = shallowRef<MailboxGroup>(),
  opened = shallowRef<MailboxGroup>()
const errors = useProblemForm({ fieldId: groupFieldId })
const dirty = computed(
  () =>
    !!form.value &&
    !!opened.value &&
    Object.keys(groupPatch(form.value, opened.value, opened.value.adminFieldsEditable)).length > 0,
)
const leave = useLeaveGuard(() => dirty.value || actionBusy.value, 'leaveGuard.body')
const version = useVersionedSave({
  current: () => base.value,
  refetch: async () => {
    const value = await fetchGroup(id.value)
    base.value = value
    client.setQueryData(groupDetailKey(id.value), value)
    return value
  },
})
watch(id, () => {
  form.value = undefined
  opened.value = undefined
  base.value = undefined
  version.discard()
  errors.clear()
})
function open() {
  if (!stored.value) return
  base.value = stored.value
  opened.value = stored.value
  form.value = groupForm(stored.value)
  version.discard()
  errors.clear()
}
async function close() {
  if (dirty.value && !(await leave.ask())) return
  form.value = undefined
  version.discard()
  errors.clear()
}
async function updated(group: MailboxGroup) {
  client.setQueryData(groupDetailKey(id.value), group)
  await client.invalidateQueries({ queryKey: groupKey, refetchType: 'none' })
  await client.invalidateQueries({ queryKey: queryKeys.aliases.all() })
  await client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
}
async function save() {
  if (!form.value || !opened.value || version.pending.value) return
  errors.clear()
  const patch = groupPatch(form.value, opened.value, opened.value.adminFieldsEditable)
  if (Object.keys(patch).length === 0) {
    form.value = undefined
    return
  }
  const result = await version.save(patch, (patch, etag) => updateGroup(id.value, patch, etag))
  if (result.status === 'saved') {
    form.value = undefined
    await updated(result.result)
  } else if (result.status === 'failed') await errors.setProblem(result.problem)
}
async function reapply() {
  if (
    !stored.value ||
    actionBusy.value ||
    !(await confirm({
      title: t('mailboxGroups.reapply'),
      description: t('mailboxGroups.reapplyConfirm'),
      confirmLabel: lt('admin.save'),
    }))
  )
    return
  actionBusy.value = true
  try {
    await updated(await updateGroup(id.value, { reapplyTemplate: true }, stored.value.etag))
  } catch (error) {
    await errors.setProblem(problemOf(error))
    await query.refetch()
  } finally {
    actionBusy.value = false
  }
}
async function remove() {
  const ask = () =>
    confirm({
      title: t('mailboxGroups.remove'),
      description: t('mailboxGroups.removeConfirm', {
        name: base.value?.name ?? stored.value?.name ?? '',
      }),
      confirmLabel: lt('mailbox.remove'),
      destructive: true,
    })
  if (!stored.value || actionBusy.value) return
  base.value = stored.value
  if (!(await ask())) return
  actionBusy.value = true
  try {
    const result = await version.remove((etag) => deleteGroup(id.value, etag), ask)
    if (result.status === 'saved') {
      if (result.result.warnings.length) {
        setDeletionWarnings(result.result.warnings)
      }
      await client.invalidateQueries({ queryKey: groupKey })
      await client.invalidateQueries({ queryKey: queryKeys.aliases.all() })
      await client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
      leave.disarm()
      await router.push({ name: 'mailbox-groups' })
    } else if (result.status === 'failed') await errors.setProblem(result.problem)
  } finally {
    actionBusy.value = false
  }
}
</script>
<template>
  <section class="flex w-full min-w-0 flex-col gap-4">
    <PageHeader :title="stored?.name ?? t('mailboxGroups.title')"
      ><template v-if="stored?.editable && !form" #actions
        ><button
          v-if="stored.adminFieldsEditable"
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="actionBusy"
          @click="reapply"
        >
          {{ t('mailboxGroups.reapply') }}</button
        ><button
          type="button"
          :class="buttonVariants({ variant: 'destructive' })"
          :disabled="actionBusy || version.pending.value"
          @click="remove"
        >
          {{ lt('mailbox.remove') }}
        </button></template
      ></PageHeader
    >
    <ProblemMessage :problem="problemOf(query.error.value)" @retry="query.refetch()" />
    <p v-if="query.isPending.value" role="status">{{ lt('datatables.loadingRecords') }}</p>
    <template v-if="stored">
      <div class="flex flex-wrap items-center gap-2">
        <MailboxStatusBadge :status="stored.active ? 'active' : 'inactive'" />
        <p v-if="!stored.editable" class="text-sm text-muted">{{ t('mailboxGroups.readOnly') }}</p>
      </div>
      <GroupWarnings :warnings="stored.warnings" />
      <ProblemMessage v-if="!form" :problem="errors.formProblem.value" />
      <EditableSection
        section-id="mailbox-group"
        :title="t('mailboxGroups.settings')"
        :editable="stored.editable && !actionBusy"
        :editing="!!form"
        :saving="version.pending.value"
        :version-changed="version.outdated.value"
        :can-save="stored.editable"
        @edit="open"
        @cancel="close"
        @save="save"
        @save-again="save"
        @discard="open"
      >
        <GroupOverview :group="stored" />
        <template #form
          ><ErrorSummary :id="errors.summaryId" :items="errors.summary.value" /><ProblemMessage
            :problem="errors.formProblem.value" />
          <fieldset v-if="form" :disabled="version.pending.value" class="min-w-0 space-y-5">
            <GroupFormFields
              v-model="form"
              :creating="false"
              :admin="stored.adminFieldsEditable"
              :stored="stored"
              :errors-for="errors.errorsFor"
            /></fieldset
        ></template>
      </EditableSection>
    </template>
  </section>
</template>
