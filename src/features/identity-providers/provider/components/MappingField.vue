<script setup lang="ts">
// Legacy's "Attribute Mapping" (FR-029 to FR-031): the column names `user.attribute` and
// `mailbox.template` with the add button, the "Default Template" row with its explanation (a
// tooltip in legacy, visible help here, FR-074) and the empty choice `-- Template --` as the
// template renders it, then one row per entry: the attribute value, the template (a plain select,
// as legacy) and a remove button named after the entry. Below md each entry is a card with both
// fields stacked. A stored template that no longer exists stays a choice, so the API can say so.
import { computed, nextTick, useId } from 'vue'

import { lt } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import type { ApiProblem } from '@/api'
import { CloseIcon, PlusIcon } from '@/shared/icons'

import type { MappingRow } from '../form-model'
import { HELP, ICON_BUTTON, INPUT, SELECT } from './styles'

const props = defineProps<{
  idPrefix: string
  rows: MappingRow[]
  defaultTemplate: string
  templates: readonly string[]
  templatesProblem: ApiProblem | null
  max: number
  errorsFor: (path: string) => string[]
}>()
const emit = defineEmits<{
  'update:rows': [rows: MappingRow[]]
  'update:defaultTemplate': [value: string]
  retryTemplates: []
}>()
const titleId = useId()
const empty = computed(() => `-- ${lt('mailbox.template')} --`)

/** The templates, plus a stored choice that is no longer one of them. */
function choices(current: string): string[] {
  return current && !props.templates.includes(current)
    ? [...props.templates, current]
    : [...props.templates]
}

async function add() {
  if (props.rows.length >= props.max) return
  emit('update:rows', [...props.rows, { attributeValue: '', template: '' }])
  await nextTick()
  document
    .getElementById(`${props.idPrefix}-attributeMapping-${props.rows.length}-attributeValue`)
    ?.focus()
}

function update(index: number, change: Partial<MappingRow>) {
  emit(
    'update:rows',
    props.rows.map((row, i) => (i === index ? { ...row, ...change } : row)),
  )
}

function remove(index: number) {
  emit(
    'update:rows',
    props.rows.filter((_, i) => i !== index),
  )
  document.getElementById(`${props.idPrefix}-attributeMapping-add`)?.focus()
}

const fieldErrors = (index: number, member: keyof MappingRow) =>
  props.errorsFor(`attributeMapping.${index}.${member}`)
</script>

<template>
  <div role="group" class="flex min-w-0 flex-col gap-3" :aria-labelledby="titleId">
    <div class="flex items-center gap-2">
      <LegacyText
        :id="titleId"
        k="admin.iam_mapping"
        as="p"
        class="me-auto text-sm font-medium text-gray-800 dark:text-gray-200"
      />
      <button
        :id="`${idPrefix}-attributeMapping-add`"
        type="button"
        :class="ICON_BUTTON"
        :aria-label="`${lt('admin.add')}: ${lt('admin.iam_mapping')}`"
        :disabled="rows.length >= max"
        @click="add"
      >
        <PlusIcon class="size-5" />
      </button>
    </div>
    <ProblemMessage
      v-if="templatesProblem"
      :problem="templatesProblem"
      retry
      @retry="emit('retryTemplates')"
    />
    <div class="flex flex-col gap-1.5 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
      <label
        :for="`${idPrefix}-defaultTemplate`"
        class="text-sm font-medium text-gray-800 dark:text-gray-200"
      >
        {{ lt('admin.iam_default_template') }}
      </label>
      <LegacyText
        :id="`${idPrefix}-defaultTemplate-help`"
        k="admin.iam_default_template_description"
        as="p"
        :class="HELP"
      />
      <select
        :id="`${idPrefix}-defaultTemplate`"
        :value="defaultTemplate"
        :class="SELECT"
        :aria-describedby="`${idPrefix}-defaultTemplate-help`"
        :aria-invalid="errorsFor('defaultTemplate').length ? 'true' : undefined"
        @change="emit('update:defaultTemplate', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ empty }}</option>
        <option v-for="name in choices(defaultTemplate)" :key="name" :value="name">
          {{ name }}
        </option>
      </select>
      <p
        v-for="message in errorsFor('defaultTemplate')"
        :key="message"
        class="text-sm text-red-700 dark:text-red-300"
      >
        {{ message }}
      </p>
    </div>
    <div
      class="hidden gap-2 px-3 text-sm font-medium text-gray-600 md:grid md:grid-cols-[1fr_1fr_2.75rem] dark:text-gray-400"
      aria-hidden="true"
    >
      <span>{{ lt('user.attribute') }}</span>
      <span>{{ lt('mailbox.template') }}</span>
    </div>
    <ul v-if="rows.length > 0" class="flex flex-col gap-3">
      <li
        v-for="(row, index) in rows"
        :key="index"
        data-mapping-entry
        class="grid grid-cols-1 gap-2 rounded-xl border border-gray-200 p-3 md:grid-cols-[1fr_1fr_2.75rem] md:items-start dark:border-gray-800"
      >
        <div class="flex min-w-0 flex-col gap-1">
          <label
            :for="`${idPrefix}-attributeMapping-${index}-attributeValue`"
            class="text-sm text-gray-700 md:sr-only dark:text-gray-300"
          >
            {{ lt('user.attribute') }}
          </label>
          <input
            :id="`${idPrefix}-attributeMapping-${index}-attributeValue`"
            :value="row.attributeValue"
            type="text"
            autocomplete="off"
            spellcheck="false"
            :class="INPUT"
            :aria-invalid="fieldErrors(index, 'attributeValue').length ? 'true' : undefined"
            :aria-describedby="
              fieldErrors(index, 'attributeValue').length
                ? `${idPrefix}-attributeMapping-${index}-attributeValue-error`
                : undefined
            "
            @input="update(index, { attributeValue: ($event.target as HTMLInputElement).value })"
          />
          <p
            v-if="fieldErrors(index, 'attributeValue').length"
            :id="`${idPrefix}-attributeMapping-${index}-attributeValue-error`"
            class="text-sm text-red-700 dark:text-red-300"
          >
            {{ fieldErrors(index, 'attributeValue').join(' ') }}
          </p>
        </div>
        <div class="flex min-w-0 flex-col gap-1">
          <label
            :for="`${idPrefix}-attributeMapping-${index}-template`"
            class="text-sm text-gray-700 md:sr-only dark:text-gray-300"
          >
            {{ lt('mailbox.template') }}
          </label>
          <select
            :id="`${idPrefix}-attributeMapping-${index}-template`"
            :value="row.template"
            :class="SELECT"
            :aria-invalid="fieldErrors(index, 'template').length ? 'true' : undefined"
            :aria-describedby="
              fieldErrors(index, 'template').length
                ? `${idPrefix}-attributeMapping-${index}-template-error`
                : undefined
            "
            @change="update(index, { template: ($event.target as HTMLSelectElement).value })"
          >
            <option value="">{{ empty }}</option>
            <option v-for="name in choices(row.template)" :key="name" :value="name">
              {{ name }}
            </option>
          </select>
          <p
            v-if="fieldErrors(index, 'template').length"
            :id="`${idPrefix}-attributeMapping-${index}-template-error`"
            class="text-sm text-red-700 dark:text-red-300"
          >
            {{ fieldErrors(index, 'template').join(' ') }}
          </p>
        </div>
        <button
          type="button"
          :class="ICON_BUTTON"
          class="justify-self-end md:mt-0"
          :aria-label="`${lt('mailbox.remove')}: ${row.attributeValue || lt('user.attribute')}`"
          @click="remove(index)"
        >
          <CloseIcon class="size-5" />
        </button>
      </li>
    </ul>
    <p v-if="errorsFor('attributeMapping').length" class="text-sm text-red-700 dark:text-red-300">
      {{ errorsFor('attributeMapping').join(' ') }}
    </p>
  </div>
</template>
