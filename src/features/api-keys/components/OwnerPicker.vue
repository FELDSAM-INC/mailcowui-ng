<script setup lang="ts">
// The key-owner picker (FR-064, FR-065, US7-AS12): an editable combobox (ARIA 1.2, list
// autocomplete) over the key-owner candidates the API offers, searched by username 300 ms after
// typing, with username and role per option, "Load more", and loading, no-match and error states.
// The list is rendered in place below the field, so it needs no floating layer.
// - `pick` (create form): the value is a chosen candidate; text left unchosen is reverted.
// - `filter` (list filter): a typed username is accepted too (Enter or leaving the field), so keys
//   of inactive or deleted owners can still be found.
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ApiKeyOwnerCandidate } from '@/api'
import FormField from '@/shared/components/FormField.vue'
import { buttonVariants } from '@/shared/ui/button'
import { API_KEY_OWNER_MAX_LENGTH } from '@/shared/validation/limits'

import { useOwnerCandidates } from '../api'

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    modelValue: string | null
    mode?: 'pick' | 'filter'
    description?: string
    errors?: readonly string[]
    required?: boolean
  }>(),
  { mode: 'pick' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const SEARCH_DELAY_MS = 300

const { t } = useI18n()
const listId = useId()
const optionPrefix = useId()
const container = ref<HTMLElement | null>(null)
const text = ref(props.modelValue ?? '')
const search = ref('')
const open = ref(false)
const active = ref(-1)
let timer: ReturnType<typeof setTimeout> | null = null

const query = useOwnerCandidates(search, open)
const candidates = computed<ApiKeyOwnerCandidate[]>(
  () => query.data.value?.pages.flatMap((page) => page.data) ?? [],
)
/** The results belong to the text in the field (not to an earlier search). */
const settled = computed(() => search.value === text.value.trim())
const expanded = computed(() => open.value && settled.value && candidates.value.length > 0)
const searching = computed(
  () =>
    open.value &&
    (!settled.value || (query.isPending.value && query.fetchStatus.value === 'fetching')),
)
const activeId = computed(() =>
  expanded.value && active.value >= 0 ? `${optionPrefix}-${active.value}` : undefined,
)

watch(
  () => props.modelValue,
  (value) => {
    if (!open.value) text.value = value ?? ''
  },
)
watch(candidates, () => {
  if (active.value >= candidates.value.length) active.value = candidates.value.length - 1
})

function onInput() {
  open.value = true
  active.value = -1
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    search.value = text.value.trim()
  }, SEARCH_DELAY_MS)
}

/** Opening the field searches for its text at once. */
function onFocus() {
  if (open.value) return
  if (timer) clearTimeout(timer)
  search.value = text.value.trim()
  open.value = true
}

function close() {
  open.value = false
  active.value = -1
}

function choose(candidate: ApiKeyOwnerCandidate) {
  text.value = candidate.username
  emit('update:modelValue', candidate.username)
  close()
}

/** Leaving the field without choosing: revert (pick) or accept the typed username (filter). */
function settleText() {
  if (props.mode === 'filter') {
    const typed = text.value.trim()
    const next = typed ? typed : null
    if (next !== props.modelValue) emit('update:modelValue', next)
    text.value = typed
  } else {
    text.value = props.modelValue ?? ''
  }
}

function move(step: number) {
  open.value = true
  const count = candidates.value.length
  if (count === 0) return
  active.value = Math.min(count - 1, Math.max(0, active.value + step))
  document.getElementById(`${optionPrefix}-${active.value}`)?.scrollIntoView?.({ block: 'nearest' })
}

function onKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      move(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      move(-1)
      break
    case 'Enter': {
      const candidate = expanded.value ? candidates.value[active.value] : undefined
      if (candidate) {
        event.preventDefault()
        choose(candidate)
      } else if (props.mode === 'filter') {
        event.preventDefault()
        close()
        settleText()
      } else if (open.value) {
        event.preventDefault()
      }
      break
    }
    case 'Escape':
      if (open.value) {
        event.preventDefault()
        event.stopPropagation()
      }
      close()
      if (props.mode === 'pick') text.value = props.modelValue ?? ''
      break
  }
}

function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget
  if (next instanceof Node && container.value?.contains(next)) return
  if (open.value) close()
  settleText()
}
</script>

<template>
  <div ref="container" @focusout="onFocusOut">
    <FormField
      :id="id"
      v-slot="field"
      :label="label"
      :description="description"
      :errors="errors"
      :required="required"
    >
      <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
      <input
        v-bind="field"
        v-model="text"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="expanded ? 'true' : 'false'"
        :aria-controls="expanded ? listId : undefined"
        :aria-activedescendant="activeId"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        :maxlength="API_KEY_OWNER_MAX_LENGTH"
        class="form-control"
        @input="onInput"
        @focus="onFocus"
        @keydown="onKeydown"
      />
    </FormField>
    <div v-if="open" class="mt-2 flex flex-col gap-2">
      <ul
        v-if="expanded"
        :id="listId"
        role="listbox"
        :aria-label="label"
        class="max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900"
      >
        <!-- Options are reached with the arrow keys on the input (aria-activedescendant, ARIA 1.2
             combobox), so they are not focusable themselves. -->
        <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/interactive-supports-focus -->
        <li
          v-for="(candidate, index) in candidates"
          :id="`${optionPrefix}-${index}`"
          :key="candidate.username"
          role="option"
          :aria-selected="index === active ? 'true' : 'false'"
          class="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-2 rounded-lg px-3 py-2 text-gray-800 aria-selected:bg-brand-50 aria-selected:text-brand-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/5 dark:aria-selected:bg-brand-500/15 dark:aria-selected:text-brand-200"
          @mousedown.prevent
          @click="choose(candidate)"
        >
          <span class="font-medium wrap-anywhere">{{ candidate.username }}</span>
          <span class="text-sm text-gray-600 dark:text-gray-400">{{
            t(`roles.${candidate.role}`)
          }}</span>
        </li>
      </ul>
      <p v-if="searching" role="status" class="text-sm text-gray-700 dark:text-gray-300">
        {{ t('apiKeys.ownerPicker.searching') }}
      </p>
      <div
        v-else-if="query.isError.value"
        role="alert"
        class="flex flex-wrap items-center gap-3 text-sm text-red-800 dark:text-red-200"
      >
        <span>{{ t('apiKeys.ownerPicker.error') }}</span>
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline', size: 'sm' })"
          @mousedown.prevent
          @click="query.refetch()"
        >
          {{ t('common.retry') }}
        </button>
      </div>
      <p
        v-else-if="settled && query.isSuccess.value && candidates.length === 0"
        role="status"
        class="text-sm text-gray-700 dark:text-gray-300"
      >
        {{ t('apiKeys.ownerPicker.noMatch') }}
      </p>
      <button
        v-if="expanded && query.hasNextPage.value"
        type="button"
        data-load-more
        :class="buttonVariants({ variant: 'outline', size: 'sm', class: 'self-start' })"
        :disabled="query.isFetchingNextPage.value"
        :aria-busy="query.isFetchingNextPage.value ? 'true' : 'false'"
        @mousedown.prevent
        @click="query.fetchNextPage()"
      >
        {{ t('apiKeys.ownerPicker.loadMore') }}
      </button>
    </div>
  </div>
</template>
