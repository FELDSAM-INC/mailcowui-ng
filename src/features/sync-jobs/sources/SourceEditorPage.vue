<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { problemOf, queryKeys } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { lt } from '@/i18n'
import PageHeader from '@/shared/components/PageHeader.vue'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { confirm } from '@/shared/composables/useConfirm'
import { buttonVariants } from '@/shared/ui/button'
import {
  createSource,
  updateSource,
  deleteSource,
  refreshToken,
  fetchSource,
  sourceKey,
  sourceOptions,
  sourceDetailKey,
  type SyncSource,
} from './api'
import { sourceFieldId, sourceForm, sourceValues, sourcePatch, type SourceForm } from './form'
import SourceFields from './SourceFields.vue'
import SourceOverview from './SourceOverview.vue'
import SourceConnections from './SourceConnections.vue'
const { t } = useI18n(),
  route = useRoute(),
  router = useRouter(),
  client = useQueryClient(),
  identity = useIdentityQuery()
const role = computed(() => identity.data.value?.role ?? 'mailboxUser')
const creating = computed(() => route.name === 'sync-source-create'),
  id = computed(() => Number(route.params.sourceId))
const query = useQuery(computed(() => ({ ...sourceOptions(id.value), enabled: !creating.value })))
const stored = computed(() => query.data.value)
const form = ref<SourceForm>(),
  opened = shallowRef<SyncSource>(),
  base = shallowRef<SyncSource>(),
  busy = ref(false),
  parseError = ref('')
let initial = ''
const errors = useProblemForm({ fieldId: sourceFieldId })
const dirty = computed(() => !!form.value && JSON.stringify(form.value) !== initial)
const leave = useLeaveGuard(() => dirty.value || busy.value, 'leaveGuard.body')
const version = useVersionedSave({
  current: () => base.value,
  refetch: async () => {
    const source = await fetchSource(id.value)
    base.value = source
    client.setQueryData(sourceDetailKey(id.value), source)
    return source
  },
})
watch(
  () => route.fullPath,
  () => {
    form.value = creating.value ? sourceForm() : undefined
    initial = JSON.stringify(form.value)
    version.discard()
    errors.clear()
    parseError.value = ''
  },
  { immediate: true },
)
function edit() {
  if (!stored.value) return
  opened.value = stored.value
  base.value = stored.value
  form.value = sourceForm(stored.value)
  initial = JSON.stringify(form.value)
  version.discard()
  errors.clear()
  parseError.value = ''
}
async function cancel() {
  if (dirty.value && !(await leave.ask())) return
  form.value = undefined
  version.discard()
  errors.clear()
}
async function updated(source: SyncSource) {
  await client.invalidateQueries({ queryKey: sourceKey, refetchType: 'none' })
  client.setQueryData(sourceDetailKey(source.id), source)
  await client.invalidateQueries({ queryKey: queryKeys.syncJobs.lists() })
  await client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
}
async function save() {
  if (!form.value || busy.value || version.pending.value) return
  errors.clear()
  parseError.value = ''
  let patch
  try {
    patch = creating.value ? sourceValues(form.value) : sourcePatch(form.value, opened.value!)
  } catch {
    parseError.value = t('syncSources.invalidJson')
    return
  }
  if (creating.value) {
    busy.value = true
    try {
      const source = await createSource({
        ...patch,
        name: form.value.name,
        remoteHost: form.value.remoteHost,
        remotePort: Number(form.value.remotePort),
      })
      await updated(source)
      leave.disarm()
      await router.replace({ name: 'sync-source-detail', params: { sourceId: source.id } })
    } catch (e) {
      await errors.setProblem(problemOf(e))
    } finally {
      busy.value = false
    }
  } else {
    if (!Object.keys(patch).length) {
      form.value = undefined
      return
    }
    const result = await version.save(patch, (body, etag) => updateSource(id.value, body, etag))
    if (result.status === 'saved') {
      form.value = undefined
      await updated(result.result)
    } else if (result.status === 'failed') await errors.setProblem(result.problem)
  }
}
async function remove() {
  if (!stored.value || busy.value) return
  const ask = () =>
    confirm({
      title: t('syncSources.remove'),
      description: t('syncSources.removeConfirm', { name: stored.value?.name ?? '' }),
      confirmLabel: lt('mailbox.remove'),
      destructive: true,
    })
  if (!(await ask())) return
  base.value = stored.value
  busy.value = true
  try {
    const result = await version.remove((etag) => deleteSource(id.value, etag), ask)
    if (result.status === 'saved') {
      await client.invalidateQueries({ queryKey: sourceKey })
      leave.disarm()
      await router.push({ name: 'sync-sources' })
    } else if (result.status === 'failed') await errors.setProblem(result.problem)
  } finally {
    busy.value = false
  }
}
async function refresh() {
  if (!stored.value || busy.value) return
  busy.value = true
  errors.clear()
  try {
    await updated(await refreshToken(id.value, stored.value.etag))
  } catch (e) {
    await errors.setProblem(problemOf(e))
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <section class="flex w-full min-w-0 flex-col gap-4">
    <PageHeader :title="creating ? t('syncSources.create') : (stored?.name ?? t('nav.syncSources'))"
      ><template v-if="stored?.editable && !form && !creating" #actions
        ><button
          v-if="stored.oauth?.flow === 'client_credentials'"
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="busy"
          @click="refresh"
        >
          {{ t('syncSources.refreshToken') }}</button
        ><button
          type="button"
          :class="buttonVariants({ variant: 'destructive' })"
          :disabled="busy"
          @click="remove"
        >
          {{ lt('mailbox.remove') }}
        </button></template
      ></PageHeader
    >
    <ProblemMessage :problem="problemOf(query.error.value)" @retry="query.refetch()" />
    <ErrorSummary :id="errors.summaryId" :items="errors.summary.value" /><ProblemMessage
      :problem="errors.formProblem.value"
    />
    <p v-if="parseError" role="alert" class="text-sm text-danger">{{ parseError }}</p>
    <form
      v-if="creating && form"
      class="space-y-5 rounded-2xl border border-line bg-surface p-4 md:p-6"
      @submit.prevent="save"
    >
      <fieldset :disabled="busy" class="min-w-0 space-y-5">
        <SourceFields v-model="form" :role="role" creating :errors-for="errors.errorsFor" />
      </fieldset>
      <div class="flex items-center justify-between gap-3 border-t border-line pt-4">
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          @click="router.push({ name: 'sync-sources' })"
        >
          {{ lt('footer.cancel') }}</button
        ><button type="submit" :class="buttonVariants({})" :disabled="busy">
          {{ t('syncSources.create') }}
        </button>
      </div>
    </form>
    <template v-else-if="stored"
      ><p v-if="!stored.editable" class="text-sm text-muted">{{ t('syncSources.readOnly') }}</p>
      <EditableSection
        section-id="sync-source"
        :title="t('syncSources.settings')"
        :editable="stored.editable && !busy"
        :editing="!!form"
        :saving="version.pending.value"
        :version-changed="version.outdated.value"
        @edit="edit"
        @save="save"
        @save-again="save"
        @discard="edit"
        @cancel="cancel"
        ><SourceOverview :source="stored" /><template #form
          ><fieldset v-if="form" :disabled="version.pending.value" class="min-w-0 space-y-5">
            <SourceFields
              v-model="form"
              :role="role"
              :creating="false"
              :stored="stored"
              :errors-for="errors.errorsFor"
            /></fieldset></template></EditableSection
      ><SourceConnections
        v-if="!form && stored.oauth?.flow === 'authorization_code'"
        :source-id="stored.id"
    /></template>
  </section>
</template>
