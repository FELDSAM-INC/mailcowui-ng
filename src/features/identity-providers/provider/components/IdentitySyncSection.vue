<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, toRaw, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { problemOf, queryKeys } from '@/api'
import { lt } from '@/i18n'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { confirm } from '@/shared/composables/useConfirm'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'
import { Badge } from '@/shared/ui/badge'
import { buttonVariants } from '@/shared/ui/button'
import {
  identitySyncKey,
  synchronisationOptions,
  updateSynchronisation,
  requestSyncRun,
  type IdentitySyncSettings,
  type IdentitySyncStatus,
  type IdentitySyncRun,
} from '../synchronisation-api'
import SwitchField from './SwitchField.vue'
import TextField from './TextField.vue'
import { INPUT } from './styles'
import IdentitySyncRuns from './IdentitySyncRuns.vue'
import IdentityLinkSection from './IdentityLinkSection.vue'

const emit = defineEmits<{ dirty: [value: boolean] }>()
const { t } = useI18n()
const client = useQueryClient()
const query = useQuery(synchronisationOptions())
const stored = computed(() => query.data.value)
const base = shallowRef<IdentitySyncStatus>()
const form = ref<IdentitySyncSettings>()
const editing = computed(() => !!form.value)
const dirty = computed(
  () => !!form.value && JSON.stringify(form.value) !== JSON.stringify(base.value?.settings),
)
const errors = useProblemForm({ fieldId: (path) => `identity-sync-${path.split('.')[0]}` })
const saveState = useVersionedSave({
  current: () => base.value,
  refetch: async () => (await query.refetch()).data,
})
const busy = ref(false)
const runProblem = shallowRef<ReturnType<typeof problemOf>>(null)
const message = ref('')
const ldapFields = [
  'idAttribute',
  'disabledFilter',
  'groupBaseDn',
  'groupFilter',
  'groupNameAttribute',
  'groupMemberAttribute',
] as const
const switches = ['offboarding', 'groupSync', 'groupAutocreate'] as const
const shownFields = computed<(keyof IdentitySyncSettings)[]>(() => [
  ...switches,
  'offboardingLimit',
  'groupDefaultDomain',
  ...(stored.value?.provider === 'ldap'
    ? ([...ldapFields, 'groupMemberMode'] as const)
    : (['groupPaths'] as const)),
])
watch(dirty, (value) => emit('dirty', value), { immediate: true })
onBeforeUnmount(() => emit('dirty', false))
function open() {
  if (!stored.value) return
  errors.clear()
  base.value = stored.value
  form.value = structuredClone(toRaw(stored.value.settings))
  saveState.discard()
}
async function close() {
  if (
    dirty.value &&
    !(await confirm({
      title: t('leaveGuard.title'),
      description: t('leaveGuard.body'),
      confirmLabel: t('leaveGuard.leave'),
      cancelLabel: t('leaveGuard.stay'),
      destructive: true,
    }))
  )
    return
  form.value = undefined
  saveState.discard()
}
function patch(): Partial<IdentitySyncSettings> {
  return Object.fromEntries(
    shownFields.value
      .filter(
        (key) => JSON.stringify(form.value?.[key]) !== JSON.stringify(base.value?.settings[key]),
      )
      .map((key) => [key, form.value![key]]),
  )
}
async function save() {
  if (!form.value || !base.value || saveState.pending.value) return
  if (!dirty.value) {
    form.value = undefined
    return
  }
  if (
    form.value.idAttribute !== base.value.settings.idAttribute &&
    !(await confirm({
      title: t('identitySync.idChangeTitle'),
      description: t('identitySync.idChangeBody'),
      confirmLabel: lt('admin.save'),
      destructive: true,
    }))
  )
    return
  errors.clear()
  const result = await saveState.save(patch(), updateSynchronisation)
  if (result.status === 'saved') {
    client.setQueryData(identitySyncKey, result.result)
    await client.invalidateQueries({ queryKey: queryKeys.identityProvider.configuration() })
    await client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
    form.value = undefined
  } else if (result.status === 'outdated' && result.latest) {
    base.value = result.latest
  } else if (result.status === 'failed') await errors.setProblem(result.problem)
}
async function run(mode: IdentitySyncRun['mode']) {
  if (busy.value) return
  if (
    mode !== 'preview' &&
    !(await confirm({
      title: t(`identitySync.actions.${mode}`),
      description: t(`identitySync.${mode}Confirmation`),
      confirmLabel: t(`identitySync.actions.${mode}`),
      destructive: mode === 'force',
      ...(mode === 'force' ? { acknowledge: { label: t('identitySync.forceAcknowledge') } } : {}),
    }))
  )
    return
  busy.value = true
  runProblem.value = null
  message.value = ''
  try {
    await requestSyncRun(mode)
    await query.refetch()
    message.value = t('identitySync.queued')
    await client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
  } catch (error) {
    runProblem.value = problemOf(error)
  } finally {
    busy.value = false
  }
}
function valueText(value: IdentitySyncSettings[keyof IdentitySyncSettings]) {
  if (typeof value === 'boolean') return t(value ? 'domains.values.yes' : 'domains.values.no')
  return Array.isArray(value)
    ? value.join(', ') || t('domains.values.none')
    : String(value ?? t('domains.values.none'))
}
</script>

<template>
  <ProblemMessage
    v-if="query.isError.value"
    :problem="problemOf(query.error.value)"
    retry
    @retry="query.refetch()"
  />
  <template v-if="stored?.supported && stored.canSync">
    <EditableSection
      section-id="identity-sync"
      :title="t('identitySync.settingsTitle')"
      editable
      :editing="editing"
      :saving="saveState.pending.value"
      :version-changed="saveState.outdated.value"
      @edit="open"
      @cancel="close"
      @save="save"
      @save-again="save"
      @discard="open"
    >
      <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {{ t('identitySync.description') }}
      </p>
      <dl class="grid gap-3 text-sm sm:grid-cols-2">
        <div v-for="key in shownFields" :key="key" class="min-w-0">
          <dt class="text-gray-600 dark:text-gray-400">{{ t(`identitySync.fields.${key}`) }}</dt>
          <dd class="break-words">
            <Badge
              v-if="typeof stored.settings[key] === 'boolean'"
              :color="stored.settings[key] ? 'success' : 'gray'"
              >{{ valueText(stored.settings[key]) }}</Badge
            ><template v-else>{{ valueText(stored.settings[key]) }}</template>
          </dd>
        </div>
      </dl>
      <template #form>
        <ErrorSummary :id="errors.summaryId" :items="errors.summary.value" />
        <ProblemMessage :problem="errors.formProblem.value" />
        <div v-if="form" class="flex flex-col gap-4">
          <SwitchField
            v-for="key in switches"
            :id="`identity-sync-${key}`"
            :key="key"
            v-model="form[key]"
            :label="t(`identitySync.fields.${key}`)"
          />
          <TextField
            id="identity-sync-offboardingLimit"
            :model-value="String(form.offboardingLimit)"
            type="number"
            :min="0"
            :max="100"
            :label="t('identitySync.fields.offboardingLimit')"
            :description="t('identitySync.limitHelp')"
            :errors="errors.errorsFor('offboardingLimit')"
            @update:model-value="form.offboardingLimit = Number($event)"
          />
          <TextField
            id="identity-sync-groupDefaultDomain"
            v-model="form.groupDefaultDomain"
            :label="t('identitySync.fields.groupDefaultDomain')"
            :errors="errors.errorsFor('groupDefaultDomain')"
          />
          <template v-if="stored.provider === 'ldap'">
            <TextField
              v-for="key in ldapFields"
              :id="`identity-sync-${key}`"
              :key="key"
              v-model="form[key]"
              :label="t(`identitySync.fields.${key}`)"
              :errors="errors.errorsFor(key)"
              :description="key === 'idAttribute' ? t('identitySync.idHelp') : undefined"
            />
            <FormField
              id="identity-sync-groupMemberMode"
              :label="t('identitySync.fields.groupMemberMode')"
              :errors="errors.errorsFor('groupMemberMode')"
              ><template #default="control"
                ><select v-bind="control" v-model="form.groupMemberMode" :class="INPUT">
                  <option
                    v-for="mode in ['memberof', 'member', 'ad_chain'] as const"
                    :key="mode"
                    :value="mode"
                  >
                    {{ t(`identitySync.memberModes.${mode}`) }}
                  </option>
                </select></template
              ></FormField
            >
          </template>
          <TextField
            v-else
            id="identity-sync-groupPaths"
            :model-value="form.groupPaths.join(', ')"
            :label="t('identitySync.fields.groupPaths')"
            :description="t('identitySync.pathsHelp')"
            :errors="errors.errorsFor('groupPaths')"
            @update:model-value="
              form.groupPaths = $event
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            "
          />
        </div>
      </template>
    </EditableSection>
    <section class="flex min-w-0 flex-col gap-4" :aria-label="t('identitySync.runsTitle')">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="me-auto text-lg font-semibold">{{ t('identitySync.runsTitle') }}</h2>
        <button
          v-for="mode in ['preview', 'run', 'force'] as const"
          :key="mode"
          type="button"
          :class="buttonVariants({ variant: mode === 'run' ? 'default' : 'outline' })"
          :disabled="busy || editing"
          @click="run(mode)"
        >
          {{ t(`identitySync.actions.${mode}`) }}
        </button>
      </div>
      <dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div v-for="(value, key) in stored.counts" :key="key">
          <dt class="text-gray-600 dark:text-gray-400">{{ t(`identitySync.counts.${key}`) }}</dt>
          <dd class="font-semibold">{{ value }}</dd>
        </div>
      </dl>
      <p v-if="message" role="status">{{ message }}</p>
      <ProblemMessage :problem="runProblem" />
      <IdentitySyncRuns
        :runs="stored.runs"
        :refreshing="query.isFetching.value"
        @refresh="query.refetch()"
      />
    </section>
  </template>
  <IdentityLinkSection v-if="stored?.supported" />
</template>
