<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { problemOf, type Preset, type RspamdSettingsRule } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import CodeEditor from '@/shared/components/code-editor/CodeEditor.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { utf8ByteLength } from '@/shared/validation/utf8'
import { buttonVariants } from '@/shared/ui/button'
import {
  createRule,
  fetchRule,
  updateRule,
  validateNewRule,
  validateRule,
} from '../../api/rspamd-rules'
import PresetPicker from './PresetPicker.vue'
const props = withDefaults(defineProps<{ stored?: RspamdSettingsRule; maxBytes?: number }>(), {
  maxBytes: 1_048_576,
})
const emit = defineEmits<{ saved: [item: RspamdSettingsRule] }>()
const { t } = useI18n(),
  format = useFormat(),
  client = useQueryClient()
const stored = shallowRef(props.stored)
const description = ref(props.stored?.description ?? ''),
  content = ref(props.stored?.content ?? ''),
  active = ref(props.stored?.active ?? true)
const fingerprint = computed(() => JSON.stringify([description.value, content.value, active.value]))
const baseline = ref(fingerprint.value)
const pending = ref(false),
  outdated = ref(false),
  checked = ref(false),
  saved = ref(false)
const marks = ref<{ line: number; message: string }[]>([])
let disposed = false
onScopeDispose(() => {
  disposed = true
})
useLeaveGuard(() => fingerprint.value !== baseline.value || pending.value, 'leaveGuard.body')
const form = useProblemForm({
  fieldId: (path) => (['description', 'content'].includes(path) ? `rule-${path}` : null),
})
watch(fingerprint, () => {
  checked.value = false
  saved.value = false
  marks.value = []
  form.clear()
})
const body = () => ({
  description: description.value,
  content: content.value,
  active: active.value,
})
async function submit(checkOnly = false) {
  if (disposed || pending.value) return
  form.clear()
  marks.value = []
  saved.value = false
  checked.value = false
  const errors: Record<string, string[]> = {}
  if (!description.value.trim()) errors.description = [lt('danger.value_missing')]
  else if (Array.from(description.value).length > 255)
    errors.description = [t('validation.tooLong', { max: 255 })]
  if (!content.value.trim()) errors.content = [lt('danger.map_content_empty')]
  else if (utf8ByteLength(content.value) > props.maxBytes)
    errors.content = [t('validation.tooLongBytes', { max: format.bytes(props.maxBytes) })]
  if (Object.keys(errors).length) {
    await form.setClientMessages(errors)
    return
  }
  const draft = fingerprint.value
  pending.value = true
  try {
    if (checkOnly) {
      if (stored.value) await validateRule(stored.value, body())
      else await validateNewRule(body())
      if (!disposed && draft === fingerprint.value) {
        checked.value = true
        announce(lt('add.validation_success'))
      }
    } else {
      const item = stored.value
        ? await updateRule(client, stored.value, body())
        : await createRule(client, body())
      if (disposed || draft !== fingerprint.value) return
      stored.value = item
      baseline.value = draft
      outdated.value = false
      saved.value = true
      announce(
        props.stored
          ? lt('success.object_modified', String(item.id))
          : lt('success.settings_map_added'),
      )
      emit('saved', item)
    }
  } catch (error) {
    if (disposed || draft !== fingerprint.value) return
    const failure = problemOf(error)
    if (failure?.status === 412 && stored.value) {
      outdated.value = true
      try {
        const fresh = await fetchRule(stored.value.id)
        if (!disposed && draft === fingerprint.value) stored.value = fresh
      } catch (readError) {
        if (!disposed) await form.setProblem(problemOf(readError))
      }
    } else {
      const structural =
        failure?.fieldErrors
          .get('content')
          ?.filter((error) => error.code === 'unbalancedStructure') ?? []
      if (structural.length) {
        const known = [
          'unclosedBrace',
          'unclosedBracket',
          'unexpectedBrace',
          'unexpectedBracket',
          'unclosedString',
        ]
        marks.value = structural.map((error) => ({
          line: typeof error.params?.line === 'number' ? error.params.line : 1,
          message: t(
            `systemSettings.rules.${known.includes(String(error.params?.construct)) ? String(error.params?.construct) : 'invalidStructure'}`,
          ),
        }))
        await form.setClientMessages({
          content: marks.value.map(
            (mark) => `${t('codeEditor.line', { line: mark.line })}: ${mark.message}`,
          ),
        })
      } else await form.setProblem(failure)
    }
  } finally {
    pending.value = false
  }
}
function discard() {
  if (!stored.value || pending.value) return
  description.value = stored.value.description
  content.value = stored.value.content
  active.value = stored.value.active
  baseline.value = fingerprint.value
  outdated.value = false
  form.clear()
}
function insert(preset: Preset) {
  content.value = preset.content
  if (!description.value.trim()) description.value = preset.headline
}
</script>
<template>
  <div class="min-w-0 space-y-5">
    <form novalidate class="min-w-0 space-y-4" data-rule-form @submit.prevent="submit()">
      <ErrorSummary :id="form.summaryId" :items="form.summary.value" />
      <div v-if="outdated" class="surface space-y-2" role="alert" data-rule-outdated>
        <p class="font-semibold">{{ t('sections.outdated.title') }}</p>
        <p>{{ t('sections.outdated.body') }}</p>
        <p class="wrap-anywhere">
          {{ stored?.description }} ·
          {{ lt(stored?.active ? 'mailbox.active' : 'mailbox.inactive') }}
        </p>
        <pre class="max-h-48 overflow-auto whitespace-pre-wrap break-words text-sm">{{
          stored?.content
        }}</pre>
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="pending"
          @click="discard"
        >
          {{ t('sections.discard') }}
        </button>
      </div>
      <fieldset :disabled="pending" class="min-w-0 space-y-4">
        <FormField
          id="rule-description"
          :label="lt('admin.rsetting_desc')"
          :errors="form.errorsFor('description')"
          required
          ><template #default="control"
            ><input
              v-bind="control"
              v-model="description"
              maxlength="255"
              class="form-control" /></template
        ></FormField>
        <CodeEditor
          id="rule-content"
          v-model="content"
          :label="lt('admin.rsetting_content')"
          :max-bytes="maxBytes"
          :marks="marks"
          :errors="marks.length ? [] : form.errorsFor('content')"
          :disabled="pending"
          required
        />
        <label class="flex min-h-11 items-center gap-3 text-sm"
          ><input id="rule-active" v-model="active" type="checkbox" class="size-5" />{{
            lt('admin.active')
          }}</label
        >
        <ProblemMessage :problem="form.formProblem.value" />
        <p
          v-if="checked"
          role="status"
          data-rule-checked
          class="text-green-800 dark:text-green-200"
        >
          {{ lt('add.validation_success') }}
        </p>
        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            data-rule-check
            :class="buttonVariants({ variant: 'outline' })"
            @click="submit(true)"
          >
            {{ lt('add.validate') }}</button
          ><button type="submit" :class="buttonVariants({})">
            {{ outdated ? t('sections.saveAgain') : lt(props.stored ? 'admin.save' : 'admin.add') }}
          </button>
        </div>
      </fieldset>
      <p v-if="saved" role="status" data-rule-saved class="text-green-800 dark:text-green-200">
        {{
          lt(
            props.stored ? 'success.object_modified' : 'success.settings_map_added',
            String(stored?.id),
          )
        }}. {{ t('systemSettings.rules.refreshNote') }}
      </p>
    </form>
    <p class="text-sm text-gray-700 dark:text-gray-300">
      {{ t('systemSettings.rules.refreshNote') }}
    </p>
    <PresetPicker kind="rspamd" :replace="!!content" :disabled="pending" @select="insert" />
  </div>
</template>
