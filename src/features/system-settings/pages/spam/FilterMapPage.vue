<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  problemOf,
  queryKeys,
  type ApiProblem,
  type RspamdRegexMap,
  type SettingsCapabilities,
} from '@/api'
import { lt } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import PlainText from '@/shared/components/PlainText.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import CodeEditor from '@/shared/components/code-editor/CodeEditor.vue'
import { buttonVariants } from '@/shared/ui/button'
import { announce } from '@/shared/composables/useAnnouncer'
import { useConfirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'
import { utf8ByteLength } from '@/shared/validation/utf8'
import { regexMapOptions, replaceRegexMap, checkRegexMap } from '../../api/regex-maps'
import { createRegexLineValidator } from '../../lib/regex-lines'
import { lineDiff } from '../../lib/line-diff'
import MapChangeReview from '../../components/spam/MapChangeReview.vue'
const props = defineProps<{ capabilities: SettingsCapabilities }>()
const { t } = useI18n()
const { problemMessage } = useProblemMessages()
const route = useRoute()
const client = useQueryClient()
const confirm = useConfirm()
const id = computed(() => String(route.params.mapId))
const query = useQuery(computed(() => regexMapOptions(id.value)))
const base = shallowRef<RspamdRegexMap>()
const editing = ref(false),
  draft = ref(''),
  reviewing = ref(false),
  notice = ref('')
const failure = shallowRef<ApiProblem | null>(null)
const attemptedWrite = ref(false)
const notFound = computed(() => !query.data.value && problemOf(query.error.value)?.status === 404)
const writeFailure = computed(() => attemptedWrite.value && (failure.value?.status ?? 0) >= 500)
const serverMarks = ref<{ line: number; message: string }[]>([])
const editor = ref<InstanceType<typeof CodeEditor>>()
const version = useVersionedSave({
  current: () => base.value,
  refetch: () => client.fetchQuery({ ...regexMapOptions(id.value), staleTime: 0 }),
})
const busy = computed(() => version.pending.value || reviewing.value)
const dirty = computed(() => editing.value && draft.value !== base.value?.content)
const unavailable = computed(
  () => !query.data.value?.available || failure.value?.is('regex-map-unavailable'),
)
const content = computed(() => (editing.value ? draft.value : (query.data.value?.content ?? '')))
const validateLines = createRegexLineValidator()
const localMarks = computed(() =>
  validateLines(content.value).map((mark) => ({
    line: mark.line,
    message: t(`systemSettings.filterMaps.reasons.${mark.reason}`),
  })),
)
const marks = computed(() => [...localMarks.value, ...serverMarks.value])
const sizeInvalid = computed(
  () => utf8ByteLength(content.value) > props.capabilities.limits.rspamdRegexMapMaxBytes,
)
let disposed = false
onScopeDispose(() => {
  disposed = true
})
function open() {
  if (!query.data.value || unavailable.value) return
  base.value = query.data.value
  draft.value = base.value.content
  editing.value = true
  notice.value = ''
  failure.value = null
  serverMarks.value = []
  version.discard()
}
function discard() {
  if (busy.value) return
  editing.value = false
  failure.value = null
  serverMarks.value = []
  version.discard()
}
watch(draft, () => {
  serverMarks.value = []
  notice.value = ''
  failure.value = null
})
watch(id, () => {
  editing.value = false
  base.value = undefined
  failure.value = null
  serverMarks.value = []
  notice.value = ''
  version.discard()
})
async function submit(checkOnly: boolean) {
  if (busy.value || unavailable.value) return
  if (sizeInvalid.value || localMarks.value.length) {
    await editor.value?.goToLine(localMarks.value[0]?.line ?? 1)
    return
  }
  attemptedWrite.value = !checkOnly
  const body = content.value,
    mapId = id.value
  if (!editing.value) base.value = query.data.value
  if (!base.value) return
  if (version.outdated.value) {
    if (!version.latest.value) return
    base.value = version.latest.value
  }
  if (!checkOnly) {
    reviewing.value = true
    try {
      const approved = await confirm({
        title: t('systemSettings.filterMaps.review'),
        description: t('systemSettings.filterMaps.reload'),
        confirmLabel: lt('admin.save'),
        content: { component: MapChangeReview, props: lineDiff(base.value.content, body) },
      })
      if (!approved || disposed || id.value !== mapId) return
    } finally {
      reviewing.value = false
    }
  }
  notice.value = ''
  failure.value = null
  serverMarks.value = []
  try {
    const result = await version.save(body, (value, etag) =>
      checkOnly ? checkRegexMap(mapId, value, etag) : replaceRegexMap(mapId, value, etag),
    )
    if (disposed || id.value !== mapId) return
    if (result.status === 'saved') {
      if (!checkOnly && 'etag' in result.result) {
        client.setQueryData(queryKeys.rspamdRegexMaps.detail(mapId), result.result)
        void client.invalidateQueries({ queryKey: queryKeys.rspamdRegexMaps.lists() })
        void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
        editing.value = false
        base.value = result.result
      }
      notice.value = checkOnly
        ? t('systemSettings.filterMaps.valid')
        : `${lt('success.object_modified')} ${t('systemSettings.filterMaps.reload')}`
      announce(notice.value)
    } else if (result.status === 'failed') {
      failure.value = result.problem
      for (const violation of result.problem.fieldErrors.get('content') ?? []) {
        const line = Number(violation.params?.line),
          reason = violation.params?.reason
        if (Number.isInteger(line) && line > 0)
          serverMarks.value.push({
            line,
            message: t(
              ['notSlashDelimited', 'tooManyFlags', 'innerSlash', 'doesNotCompile'].includes(
                String(reason),
              )
                ? `systemSettings.filterMaps.reasons.${String(reason)}`
                : 'validation.invalid',
            ),
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
  <section v-if="notFound" class="space-y-4">
    <NotFoundPage
      :back-to="{ name: 'system-settings-filter-maps' }"
      :back-label="lt('admin.rspamd_global_filters')"
    />
    <p role="status"><PlainText :value="lt('danger.global_map_invalid', id)" /></p>
  </section>
  <section v-else class="min-w-0 space-y-4">
    <RouterLink
      :to="{ name: 'system-settings-filter-maps' }"
      :class="buttonVariants({ variant: 'link' })"
      >{{ lt('admin.rspamd_global_filters') }}</RouterLink
    >
    <PageHeader :title="query.data.value?.name ?? lt('admin.regex_maps')"
      ><template #actions><HistoryLink target-type="rspamdRegexMap" :target-id="id" /></template
    ></PageHeader>
    <p v-if="query.isPending.value" role="status" aria-busy="true">{{ lt('footer.loading') }}</p>
    <ProblemMessage
      v-else-if="!query.data.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <template v-else>
      <p class="break-words font-mono text-sm">{{ id }}</p>
      <p>{{ t('systemSettings.filterMaps.format') }} <code>/example[.]org/i</code></p>
      <p v-if="unavailable" role="status" data-map-unavailable>
        {{ t('systemSettings.filterMaps.unavailable') }}
      </p>
      <p v-if="notice" role="status" data-map-notice>{{ notice }}</p>
      <div
        v-if="version.outdated.value"
        role="alert"
        data-outdated
        class="rounded-xl border border-amber-300 p-4"
      >
        <p>{{ t('systemSettings.filterMaps.outdated') }}</p>
      </div>
      <div
        v-if="writeFailure && failure"
        role="alert"
        data-map-write-error
        class="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        <PlainText :value="lt('danger.global_map_write_error', id, problemMessage(failure))" />
        <p v-if="failure.requestId" class="mt-1 text-sm break-all">
          {{ t('common.requestId', { requestId: failure.requestId }) }}
        </p>
      </div>
      <ProblemMessage v-else :problem="failure" />
      <CodeEditor
        id="regex-content"
        ref="editor"
        virtualize-large
        :model-value="content"
        :label="lt('admin.regex_maps')"
        :max-bytes="capabilities.limits.rspamdRegexMapMaxBytes"
        :marks="marks"
        :readonly="!editing || !!unavailable"
        :disabled="busy"
        @update:model-value="draft = $event"
      />
      <div
        class="sticky bottom-0 flex flex-wrap gap-2 border-t border-gray-200 bg-white py-3 dark:border-gray-700 dark:bg-gray-900"
      >
        <button
          v-if="!editing && !unavailable"
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="busy"
          @click="open"
        >
          {{ t('sections.edit') }}
        </button>
        <button
          v-if="!unavailable"
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="busy"
          @click="submit(true)"
        >
          {{ lt('add.validate') }}
        </button>
        <template v-if="editing">
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            :disabled="busy"
            @click="discard"
          >
            {{ version.outdated.value ? t('sections.discard') : lt('footer.cancel') }}
          </button>
          <button
            v-if="!unavailable"
            type="button"
            :class="buttonVariants({ variant: 'default' })"
            :disabled="busy"
            @click="submit(false)"
          >
            {{
              version.pending.value
                ? t('sections.saving')
                : version.outdated.value
                  ? t('sections.saveAgain')
                  : lt('admin.save')
            }}
          </button>
        </template>
      </div>
    </template>
  </section>
</template>
