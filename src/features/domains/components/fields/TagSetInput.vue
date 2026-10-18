<script setup lang="ts">
// A set of tags or exclusions (UI 002 research D13, FR-039, FR-058, FR-070, FR-071). A tag is
// added with Enter, a comma or the Add button and removed with its own labelled button; entries are
// trimmed, too long ones refused and case-only duplicates kept once. Optional suggestions follow
// the ARIA 1.2 combobox pattern with a plain listbox (no Reka viewport, which the CSP blocks):
// arrows move through them, Enter adds one, Escape closes them, and typing a tag keeps working
// while they load or fail.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FormField from '@/shared/components/FormField.vue'
import { CloseIcon, PlusIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { addTags } from '../../tag-set'

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    modelValue: readonly string[]
    maxLength: number
    description?: string
    errors?: readonly string[]
    chipErrors?: Readonly<Record<number, readonly string[]>>
    /** Suggestions for the typed text; undefined turns suggestions off. */
    suggestions?: readonly string[]
    suggestionsState?: 'idle' | 'loading' | 'error'
    removeLabelKey?: string
    tooLongKey?: string
    addLabel?: string
    inputmode?: 'text' | 'email' | 'url'
  }>(),
  {
    description: undefined,
    errors: () => [],
    chipErrors: () => ({}),
    suggestions: undefined,
    suggestionsState: 'idle',
    removeLabelKey: 'domains.tags.remove',
    tooLongKey: 'domains.tags.tooLong',
    addLabel: undefined,
    inputmode: 'text',
  },
)
const emit = defineEmits<{ 'update:modelValue': [value: string[]]; search: [term: string] }>()
const { t } = useI18n()

const draft = ref('')
const open = ref(false)
const active = ref(-1)
const refused = ref<string[]>([])

const listboxId = computed(() => `${props.id}-suggestions`)
const optionId = (index: number) => `${props.id}-option-${index}`
const withSuggestions = computed(() => props.suggestions !== undefined)

const chosen = computed(() => new Set(props.modelValue.map((tag) => tag.toLowerCase())))
const options = computed(() =>
  (props.suggestions ?? []).filter((tag) => !chosen.value.has(tag.toLowerCase())),
)
const showList = computed(() => withSuggestions.value && open.value && draft.value.trim() !== '')
const showOptions = computed(() => showList.value && options.value.length > 0)

const localErrors = computed(() =>
  refused.value.length > 0 ? [t(props.tooLongKey, { max: props.maxLength })] : [],
)
const allErrors = computed(() => [...localErrors.value, ...props.errors])

function commit(text: string) {
  const { tags, refused: tooLong } = addTags(props.modelValue, text, { maxLength: props.maxLength })
  refused.value = tooLong
  if (tags.length !== props.modelValue.length) emit('update:modelValue', tags)
  draft.value = tooLong.join(', ')
  active.value = -1
  open.value = false
}

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  const comma = value.lastIndexOf(',')
  if (comma >= 0) {
    commit(value.slice(0, comma))
    draft.value = [draft.value, value.slice(comma + 1)].filter((part) => part !== '').join(', ')
  } else {
    draft.value = value
    refused.value = []
  }
  active.value = -1
  open.value = true
  if (withSuggestions.value) emit('search', draft.value)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' && withSuggestions.value) {
    event.preventDefault()
    open.value = true
    if (options.value.length > 0)
      active.value = Math.min(active.value + 1, options.value.length - 1)
  } else if (event.key === 'ArrowUp' && showOptions.value) {
    event.preventDefault()
    active.value = Math.max(active.value - 1, -1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const option = showOptions.value ? options.value[active.value] : undefined
    if (option !== undefined) commit(option)
    else if (draft.value.trim() !== '') commit(draft.value)
  } else if (event.key === 'Escape' && showList.value) {
    event.preventDefault()
    event.stopPropagation()
    open.value = false
    active.value = -1
  }
}

function remove(tag: string) {
  emit(
    'update:modelValue',
    props.modelValue.filter((item) => item !== tag),
  )
}
</script>

<template>
  <FormField :id="id" :label="label" :description="description" :errors="allErrors">
    <template #default="control">
      <div class="flex flex-col gap-2">
        <ul v-if="modelValue.length > 0" class="flex flex-wrap gap-2" :aria-label="label">
          <li v-for="(tag, index) in modelValue" :key="tag" class="flex max-w-full flex-col">
            <span
              class="inline-flex max-w-full items-center gap-1 rounded-lg border ps-3 text-sm text-gray-800 dark:text-gray-200"
              :class="
                chipErrors[index]?.length
                  ? 'border-red-500 bg-red-50 dark:bg-red-950'
                  : 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
              "
            >
              <span class="min-w-0 break-all">{{ tag }}</span>
              <button
                type="button"
                class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-700"
                :aria-label="t(removeLabelKey, { tag })"
                @click="remove(tag)"
              >
                <CloseIcon class="size-4" />
              </button>
            </span>
            <span
              v-for="(message, errorIndex) in chipErrors[index] ?? []"
              :key="errorIndex"
              class="text-sm break-words text-red-700 dark:text-red-300"
            >
              <span class="sr-only">{{ `${t('a11y.errorPrefix')} ${tag}: ` }}</span
              >{{ message }}
            </span>
          </li>
        </ul>
        <div class="relative flex gap-2">
          <input
            v-bind="control"
            :value="draft"
            type="text"
            :inputmode="inputmode"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            :role="withSuggestions ? 'combobox' : undefined"
            :aria-autocomplete="withSuggestions ? 'list' : undefined"
            :aria-expanded="withSuggestions ? (showOptions ? 'true' : 'false') : undefined"
            :aria-controls="showOptions ? listboxId : undefined"
            :aria-activedescendant="showOptions && active >= 0 ? optionId(active) : undefined"
            class="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            @input="onInput"
            @keydown="onKeydown"
            @focus="open = true"
            @blur="open = false"
          />
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            :disabled="draft.trim() === ''"
            @click="commit(draft)"
          >
            <PlusIcon />
            {{ addLabel ?? t('domains.tags.add') }}
          </button>
          <div
            v-if="showList"
            class="absolute start-0 end-0 top-12 z-30 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
          >
            <p
              v-if="suggestionsState !== 'idle'"
              role="status"
              class="px-3 py-2 text-sm text-gray-600 dark:text-gray-400"
            >
              {{
                suggestionsState === 'loading'
                  ? t('domains.tags.suggestionsLoading')
                  : t('domains.tags.suggestionsUnavailable')
              }}
            </p>
            <ul
              v-if="showOptions"
              :id="listboxId"
              role="listbox"
              :aria-label="t('domains.tags.suggestions')"
            >
              <li
                v-for="(option, index) in options"
                :id="optionId(index)"
                :key="option"
                role="option"
                :aria-selected="index === active ? 'true' : 'false'"
                class="flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-gray-800 break-all hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                :class="index === active ? 'bg-gray-100 dark:bg-gray-800' : ''"
                @pointerdown.prevent="commit(option)"
              >
                {{ option }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </FormField>
</template>
