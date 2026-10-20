<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { problemOf, queryKeys, type ApiProblem, type GlobalSieveFilter } from '@/api'
import { lt } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import CodeEditor from '@/shared/components/code-editor/CodeEditor.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PlainText from '@/shared/components/PlainText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useConfirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'
import { neutralise } from '@/shared/security/plain-text'
import { buttonVariants } from '@/shared/ui/button'
import { utf8ByteLength } from '@/shared/validation/utf8'
import {
  globalFiltersOptions,
  checkGlobalFilter,
  replaceGlobalFilter,
} from '../../api/global-filters'
import RestartChoiceDialog from './RestartChoiceDialog.vue'

const props = defineProps<{ filter: GlobalSieveFilter; maxBytes: number }>()
const { t } = useI18n()
const { problemMessage } = useProblemMessages()
const client = useQueryClient()
const confirm = useConfirm()
const base = shallowRef(props.filter)
const draft = ref(props.filter.script)
const editing = ref(false)
const reviewing = ref(false)
const notice = ref('')
const failure = shallowRef<ApiProblem | null>(null)
const marks = ref<{ line: number; message: string }[]>([])
const editor = ref<InstanceType<typeof CodeEditor>>()
const version = useVersionedSave({
  current: () => base.value,
  refetch: async () =>
    (await client.fetchQuery({ ...globalFiltersOptions(), staleTime: 0 })).find(
      (filter) => filter.id === props.filter.id,
    ),
})
const busy = computed(() => reviewing.value || version.pending.value)
const dirty = computed(() => editing.value && draft.value !== base.value.script)
const unavailable = computed(() => failure.value?.is('global-sieve-filter-unavailable'))
let disposed = false
onScopeDispose(() => {
  disposed = true
})
watch(
  () => props.filter,
  (filter) => {
    if (!editing.value && !busy.value) {
      base.value = filter
      draft.value = filter.script
    }
  },
)
watch(
  draft,
  () => {
    marks.value = []
    failure.value = null
    notice.value = ''
  },
  { flush: 'sync' },
)
function discard() {
  if (busy.value) return
  base.value = version.discard() ?? props.filter
  draft.value = base.value.script
  editing.value = false
  marks.value = []
  failure.value = null
}
function edit() {
  discard()
  editing.value = true
  notice.value = ''
}
async function submit(checkOnly: boolean) {
  if (busy.value || unavailable.value) return
  if (utf8ByteLength(draft.value) > props.maxBytes) {
    await editor.value?.goToLine(1)
    return
  }
  if (version.outdated.value) {
    if (!version.latest.value) return
    base.value = version.latest.value
  }
  const script = draft.value
  let deferRestart = false
  if (!checkOnly) {
    reviewing.value = true
    try {
      const accepted = await confirm({
        title: t('systemSettings.globalSieve.confirm'),
        description: t('systemSettings.globalSieve.interruption'),
        confirmLabel: lt('admin.save'),
        content: {
          component: RestartChoiceDialog,
          props: {
            empty: !script.trim(),
            onChoice: (value: boolean) => {
              deferRestart = value
            },
          },
        },
      })
      if (!accepted || disposed) return
    } finally {
      reviewing.value = false
    }
  }
  failure.value = null
  notice.value = ''
  marks.value = []
  try {
    const result = await version.save(script, async (value, etag) =>
      checkOnly
        ? checkGlobalFilter({ ...base.value, etag }, value)
        : replaceGlobalFilter({ ...base.value, etag }, value, deferRestart),
    )
    if (disposed) return
    if (result.status === 'saved') {
      if ('filter' in result.result) {
        const saved = result.result
        client.setQueryData<GlobalSieveFilter[]>(queryKeys.globalSieveFilters(), (rows) =>
          rows?.map((row) => (row.id === saved.filter.id ? saved.filter : row)),
        )
        void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
        base.value = saved.filter
        draft.value = saved.filter.script
        editing.value = false
        const outcome = saved.restart.outcome
        notice.value = `${lt('success.global_filter_written')}. ${
          outcome === 'done'
            ? lt('success.dovecot_restart_success')
            : outcome === 'failed'
              ? `${lt('warning.dovecot_restart_failed')}. ${t('systemSettings.globalSieve.deferred')}`
              : t('systemSettings.globalSieve.deferred')
        }`
      } else notice.value = t('systemSettings.globalSieve.valid')
      announce(notice.value)
    } else if (result.status === 'failed') {
      failure.value = result.problem
      for (const violation of result.problem.fieldErrors.get('script') ?? []) {
        const line = Number(violation.params?.line)
        if (violation.code === 'sieveSyntax' && Number.isInteger(line) && line > 0)
          marks.value.push({
            line,
            message: neutralise(
              lt(
                'danger.sieve_error',
                typeof violation.params?.message === 'string' ? violation.params.message : '',
              ),
              {
                multiline: false,
              },
            )
              .map((part) => (part.kind === 'text' ? part.value : `[${part.codePoint}]`))
              .join(''),
          })
      }
    }
  } catch (error) {
    if (!disposed) failure.value = problemOf(error)
  }
}
useLeaveGuard(
  computed(() => dirty.value || busy.value),
  'leaveGuard.body',
)
</script>

<template>
  <section
    :data-global-filter="filter.id"
    :aria-labelledby="`${filter.id}-title`"
    class="min-w-0 space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-800"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 :id="`${filter.id}-title`" class="text-lg font-semibold">
        {{ t(`systemSettings.globalSieve.${filter.id}`) }}
      </h2>
      <HistoryLink target-type="globalSieveFilter" :target-id="filter.id" />
    </div>
    <p>{{ t(`systemSettings.globalSieve.${filter.id}Help`) }}</p>
    <p v-if="notice" role="status" data-filter-notice>{{ notice }}</p>
    <p v-if="version.outdated.value" role="alert" data-outdated>
      {{ t('systemSettings.globalSieve.outdated') }}
    </p>
    <p v-if="unavailable" role="alert" data-unavailable>
      {{ t('systemSettings.globalSieve.unavailable') }}
    </p>
    <ProblemMessage v-else-if="failure && !marks.length" :problem="failure" />
    <CodeEditor
      :id="`${filter.id}-script`"
      ref="editor"
      v-model="draft"
      :label="t(`systemSettings.globalSieve.${filter.id}`)"
      :max-bytes="maxBytes"
      :marks="marks"
      :readonly="!editing"
      :disabled="busy"
    />
    <p v-if="failure && marks.length" role="alert">
      <PlainText :value="problemMessage(failure)" />
    </p>
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        :disabled="busy || unavailable || version.outdated.value"
        @click="submit(true)"
      >
        {{ lt('add.validate') }}
      </button>
      <template v-if="editing">
        <button
          type="button"
          :class="buttonVariants({ variant: 'default' })"
          :disabled="busy || unavailable || (version.outdated.value && !version.latest.value)"
          @click="submit(false)"
        >
          {{ version.outdated.value ? t('sections.saveAgain') : lt('admin.save') }}
        </button>
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="busy"
          @click="discard"
        >
          {{ lt('footer.cancel') }}
        </button>
      </template>
      <button
        v-else
        type="button"
        :class="buttonVariants({ variant: 'default' })"
        :disabled="busy"
        @click="edit"
      >
        {{ t('sections.edit') }}
      </button>
    </div>
  </section>
</template>
