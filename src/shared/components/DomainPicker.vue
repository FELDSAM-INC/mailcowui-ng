<script setup lang="ts">
// A server-searched domain picker (UI 004 research D11, R7, FR-011): an editable combobox (ARIA 1.2,
// list autocomplete, no Reka viewport) over one or more sources, for example domains and alias
// domains in two labelled groups. Searches run 300 ms after typing and page by 25 with "load more",
// so thousands of domains are never loaded at once. Fetching comes through `sources` (query key and
// page loader), so shared code never imports a feature.
// - Each option shows the readable name, and the ASCII name below it when it differs.
// - `disabledReason(option)` shows an option that cannot be chosen, with its reason as text.
// - Single mode (forms): the value is one ASCII name; text left unchosen is reverted.
// - Multiple mode (filters): the chosen names are removable chips above the field.
// - States: searching, no match, and an error with a retry.
import { useInfiniteQuery } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'

import { CloseIcon } from '../icons'
import { useMediaQuery } from '../composables/useMediaQuery'
import { buttonVariants } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '../ui/dialog'
import FormField from './FormField.vue'

export interface DomainPickerOption {
  /** The ASCII name: the value that is sent. */
  name: string
  /** The readable (Unicode) name. */
  nameUnicode: string
  /** UI 004: the domain is a relay (backup MX) domain, for `disabledReason`. */
  relay?: boolean
  /** UI 004: a short note shown under the option, for example legacy's "Alias (blocked)". */
  note?: string
  /**
   * UI 009: the option's second line instead of the ASCII name, for options whose value is not a
   * name (a relayhost's ID, "inactive"; the mailboxes an alias delivers to); null for none.
   */
  detail?: string | null
}

export interface DomainPickerPage {
  items: DomainPickerOption[]
  total: number
}

export interface DomainPickerSource {
  id: string
  /** The group's label, shown when the picker has several sources. */
  label?: string
  /** The cache key of a search, so that the feature's mutations can refresh it. */
  queryKey: (q: string) => readonly unknown[]
  fetchPage: (params: { q: string; offset: number; limit: number }) => Promise<DomainPickerPage>
}

const PAGE_SIZE = 25
const SEARCH_DELAY_MS = 300
const DOMAIN_MAX_LENGTH = 253

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    sources: readonly DomainPickerSource[]
    modelValue: string | null | readonly string[]
    multiple?: boolean
    /** UI 007: stage multiple choices in a full-screen phone dialog; other callers stay inline. */
    staged?: boolean
    /** Errors keyed by ASCII name, so removing a chip cannot move an error to another name. */
    itemErrors?: Readonly<Record<string, readonly string[]>>
    placeholder?: string
    description?: string
    errors?: readonly string[]
    required?: boolean
    /** Why an option cannot be chosen, or null when it can. */
    disabledReason?: (option: DomainPickerOption) => string | null
    /** Readable names already known for chosen values (ASCII name → readable name). */
    labels?: Readonly<Record<string, string>>
    /** UI 004: in multiple mode, the parent shows the chosen values itself. */
    hideChips?: boolean
  }>(),
  {
    multiple: false,
    staged: false,
    itemErrors: () => ({}),
    placeholder: undefined,
    description: undefined,
    errors: undefined,
    required: false,
    disabledReason: undefined,
    labels: () => ({}),
    hideChips: false,
  },
)
const emit = defineEmits<{
  'update:modelValue': [value: string | null | string[]]
  /** A chosen option, so that the parent can remember its readable name. */
  pick: [option: DomainPickerOption]
}>()

const { t } = useI18n()
const listId = useId()
const optionPrefix = useId()
const container = ref<HTMLElement | null>(null)
const open = ref(false)
const wide = useMediaQuery('(min-width: 768px)')
const mobileDialog = computed(() => props.multiple && props.staged && !wide.value)
const draft = ref<string[]>([])
const search = ref('')
const active = ref(-1)
const known = ref<Record<string, string>>({})
let timer: ReturnType<typeof setTimeout> | null = null

const selected = computed<string[]>(() =>
  Array.isArray(props.modelValue)
    ? [...props.modelValue]
    : props.modelValue
      ? [props.modelValue as string]
      : [],
)
const readable = (name: string) => known.value[name] ?? props.labels[name] ?? name
const chosen = computed(() => (mobileDialog.value && open.value ? draft.value : selected.value))
const chipId = (name: string) => `${props.id}-chip-${encodeURIComponent(name)}`
const text = ref(props.multiple ? '' : selected.value[0] ? readable(selected.value[0]) : '')

watch(selected, (names) => {
  if (!props.multiple && !open.value) text.value = names[0] ? readable(names[0]) : ''
})
watch(open, (value) => {
  if (!mobileDialog.value) return
  draft.value = value ? [...selected.value] : []
  text.value = ''
  search.value = ''
  if (timer) clearTimeout(timer)
})
watch(mobileDialog, () => close())
onScopeDispose(() => {
  if (timer) clearTimeout(timer)
})

// One infinite query per source; the number of sources is fixed for a mounted picker.
const queries = props.sources.map((source) =>
  useInfiniteQuery({
    queryKey: computed(() => source.queryKey(search.value)),
    queryFn: ({ pageParam }) =>
      source.fetchPage({ q: search.value, offset: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0)
      return loaded < last.total ? loaded : undefined
    },
    enabled: open,
  }),
)

interface Entry extends DomainPickerOption {
  index: number
  reason: string | null
  chosen: boolean
}

interface Group {
  id: string
  label?: string
  entries: Entry[]
}

const groups = computed<Group[]>(() => {
  let index = 0
  return props.sources.map((source, position) => {
    const pages = queries[position]!.data.value?.pages ?? []
    const entries = pages
      .flatMap((page) => page.items)
      .map((option) => ({
        ...option,
        index: index++,
        reason: props.disabledReason?.(option) ?? null,
        chosen: chosen.value.includes(option.name),
      }))
    return { id: source.id, label: source.label, entries }
  })
})
const entries = computed(() => groups.value.flatMap((group) => group.entries))
const grouped = computed(() => props.sources.length > 1)

const settled = computed(() => search.value === text.value.trim())
const expanded = computed(() => open.value && settled.value && entries.value.length > 0)
const searching = computed(
  () =>
    open.value &&
    (!settled.value ||
      queries.some((query) => query.isPending.value && query.fetchStatus.value === 'fetching')),
)
const failed = computed(() => queries.find((query) => query.isError.value))
const noMatch = computed(
  () =>
    open.value &&
    settled.value &&
    queries.every((query) => query.isSuccess.value) &&
    entries.value.length === 0,
)
const more = computed(() => queries.filter((query) => query.hasNextPage.value))
const loadingMore = computed(() => queries.some((query) => query.isFetchingNextPage.value))
const activeId = computed(() =>
  expanded.value && active.value >= 0 ? `${optionPrefix}-${active.value}` : undefined,
)

watch(entries, () => {
  if (active.value >= entries.value.length) active.value = entries.value.length - 1
})

function onInput() {
  open.value = true
  active.value = -1
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    search.value = text.value.trim()
  }, SEARCH_DELAY_MS)
}

/** Opening the field searches for its text at once (the whole list in single mode). */
function onFocus() {
  if (open.value) return
  if (timer) clearTimeout(timer)
  if (!props.multiple) text.value = ''
  search.value = text.value.trim()
  open.value = true
}

function close() {
  if (timer) clearTimeout(timer)
  open.value = false
  active.value = -1
}

function toggleDraft(entry: Entry) {
  if (entry.reason) return
  known.value = { ...known.value, [entry.name]: entry.nameUnicode }
  draft.value = draft.value.includes(entry.name)
    ? draft.value.filter((name) => name !== entry.name)
    : [...draft.value, entry.name]
}
function applyDraft() {
  for (const name of draft.value) emit('pick', { name, nameUnicode: readable(name) })
  emit('update:modelValue', [...draft.value])
  close()
}

function choose(entry: Entry) {
  if (entry.reason) return
  known.value = { ...known.value, [entry.name]: entry.nameUnicode }
  emit('pick', { name: entry.name, nameUnicode: entry.nameUnicode })
  if (props.multiple) {
    if (!selected.value.includes(entry.name)) {
      emit('update:modelValue', [...selected.value, entry.name])
    }
    text.value = ''
    search.value = ''
    // The list closes, so that the page does not shift under the pointer; typing opens it again.
    close()
    return
  }
  emit('update:modelValue', entry.name)
  text.value = entry.nameUnicode
  close()
}

function remove(name: string) {
  emit(
    'update:modelValue',
    selected.value.filter((value) => value !== name),
  )
}

function revert() {
  text.value = props.multiple ? '' : selected.value[0] ? readable(selected.value[0]) : ''
}

function move(step: number) {
  open.value = true
  const count = entries.value.length
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
      const entry = expanded.value ? entries.value[active.value] : undefined
      if (entry || open.value) event.preventDefault()
      if (entry) choose(entry)
      break
    }
    case 'Escape':
      if (open.value) {
        event.preventDefault()
        event.stopPropagation()
      }
      close()
      revert()
      break
  }
}

function onFocusOut(event: FocusEvent) {
  if (mobileDialog.value) return
  const next = event.relatedTarget
  if (next instanceof Node && container.value?.contains(next)) return
  close()
  revert()
}

function loadMore() {
  for (const query of more.value) void query.fetchNextPage()
}

function retry() {
  for (const query of queries) if (query.isError.value) void query.refetch()
}
</script>

<template>
  <div ref="container" class="flex flex-col gap-2" @focusout="onFocusOut">
    <FormField
      :id="id"
      v-slot="field"
      :label="label"
      :description="description"
      :errors="errors"
      :required="required"
    >
      <ul
        v-if="multiple && !hideChips && selected.length > 0"
        class="flex flex-wrap gap-2"
        data-picker-chips
      >
        <li v-for="name in selected" :key="name" class="max-w-full min-w-0">
          <button
            :id="chipId(name)"
            type="button"
            :title="name"
            :aria-label="t('pickers.remove', { name: readable(name) })"
            :aria-describedby="itemErrors[name]?.length ? `${chipId(name)}-errors` : undefined"
            :class="itemErrors[name]?.length ? 'border-error-500 dark:border-error-400' : ''"
            class="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-gray-300 bg-white px-3 text-sm text-gray-800 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/5"
            @click="remove(name)"
          >
            <span class="min-w-0 wrap-anywhere">{{ readable(name) }}</span>
            <CloseIcon class="size-4 shrink-0" />
          </button>
          <ul
            v-if="itemErrors[name]?.length"
            :id="`${chipId(name)}-errors`"
            data-picker-item-errors
            class="mt-1 max-w-full text-sm wrap-anywhere text-error-700 dark:text-error-400"
          >
            <li v-for="message in itemErrors[name]" :key="message">{{ message }}</li>
          </ul>
        </li>
      </ul>
      <Dialog v-if="mobileDialog" v-model:open="open">
        <DialogTrigger as-child>
          <button
            v-bind="field"
            type="button"
            :aria-required="undefined"
            data-picker-open
            aria-haspopup="dialog"
            :class="buttonVariants({ variant: 'outline', class: 'self-start' })"
          >
            {{ t('pickers.chooseDomains') }}
          </button>
        </DialogTrigger>
        <DialogContent full-screen class="gap-0 overflow-hidden p-0 sm:p-0">
          <div class="flex shrink-0 flex-col gap-4 p-4">
            <DialogTitle class="pe-14 text-xl">{{ label }}</DialogTitle>
            <DialogDescription class="sr-only">{{
              description ?? placeholder ?? label
            }}</DialogDescription>
            <label class="flex flex-col gap-1 text-sm">
              {{ lt('datatables.search') }}
              <input
                v-model="text"
                type="search"
                data-picker-search
                autocomplete="off"
                autocapitalize="none"
                spellcheck="false"
                :placeholder="placeholder"
                :maxlength="DOMAIN_MAX_LENGTH"
                class="form-control"
                @input="onInput"
              />
            </label>
          </div>
          <div
            class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-4"
          >
            <template v-if="expanded">
              <fieldset v-for="group in groups" :key="group.id" class="min-w-0">
                <legend :class="grouped && group.label ? 'mb-2 font-semibold' : 'sr-only'">
                  {{ group.label ?? label }}
                </legend>
                <label
                  v-for="entry in group.entries"
                  :key="entry.name"
                  class="flex min-h-11 items-center gap-3 rounded-lg py-2 text-gray-800 dark:text-gray-200"
                >
                  <input
                    type="checkbox"
                    :value="entry.name"
                    :checked="entry.chosen"
                    :disabled="!!entry.reason"
                    class="size-5 shrink-0 accent-accent"
                    @change="toggleDraft(entry)"
                  />
                  <span class="min-w-0 flex-1 wrap-anywhere">
                    <span class="block font-medium">{{ entry.nameUnicode }}</span>
                    <span
                      v-if="entry.nameUnicode !== entry.name"
                      class="block text-sm text-gray-600 dark:text-gray-400"
                      >{{ entry.name }}</span
                    >
                    <span v-if="entry.note" class="block text-sm">{{ entry.note }}</span>
                    <span v-if="entry.reason" class="block text-sm">{{ entry.reason }}</span>
                  </span>
                </label>
              </fieldset>
            </template>
            <p v-if="searching" role="status">{{ lt('datatables.loadingRecords') }}</p>
            <div
              v-else-if="failed"
              role="alert"
              class="flex flex-col items-start gap-3 text-error-700 dark:text-error-400"
            >
              <p>{{ t('states.list.error') }}</p>
              <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="retry">
                {{ t('common.retry') }}
              </button>
            </div>
            <p v-else-if="noMatch" role="status">{{ lt('datatables.zeroRecords') }}</p>
            <button
              v-if="expanded && more.length"
              type="button"
              data-load-more
              :class="buttonVariants({ variant: 'outline', class: 'self-start' })"
              :disabled="loadingMore"
              :aria-busy="loadingMore ? 'true' : undefined"
              @click="loadMore"
            >
              {{ t('pickers.loadMore') }}
            </button>
          </div>
          <div
            class="flex shrink-0 flex-wrap justify-end gap-3 border-t border-gray-200 p-4 dark:border-gray-700"
          >
            <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="close">
              {{ lt('footer.cancel') }}
            </button>
            <button
              type="button"
              data-picker-done
              :class="buttonVariants({ variant: 'default' })"
              @click="applyDraft"
            >
              {{ t('pickers.done') }}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
      <input
        v-else
        v-bind="field"
        v-model="text"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="expanded ? 'true' : 'false'"
        :aria-controls="expanded ? listId : undefined"
        :aria-activedescendant="activeId"
        :placeholder="placeholder"
        autocomplete="off"
        autocapitalize="none"
        autocorrect="off"
        spellcheck="false"
        :maxlength="DOMAIN_MAX_LENGTH"
        class="form-control"
        @input="onInput"
        @focus="onFocus"
        @keydown="onKeydown"
      />
    </FormField>
    <div v-if="open && !mobileDialog" class="flex flex-col gap-2">
      <div
        v-if="expanded"
        :id="listId"
        role="listbox"
        :aria-label="label"
        :aria-multiselectable="multiple ? 'true' : undefined"
        class="max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900"
      >
        <template v-for="group in groups" :key="group.id">
          <div
            v-if="group.entries.length > 0"
            :role="grouped && group.label ? 'group' : undefined"
            :aria-labelledby="grouped && group.label ? `${optionPrefix}-${group.id}` : undefined"
          >
            <div
              v-if="grouped && group.label"
              :id="`${optionPrefix}-${group.id}`"
              role="presentation"
              class="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400"
            >
              {{ group.label }}
            </div>
            <!-- Options are reached with the arrow keys on the input (aria-activedescendant). -->
            <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/interactive-supports-focus -->
            <div
              v-for="entry in group.entries"
              :id="`${optionPrefix}-${entry.index}`"
              :key="`${group.id}-${entry.name}`"
              role="option"
              :aria-selected="
                multiple
                  ? entry.chosen
                    ? 'true'
                    : 'false'
                  : entry.index === active
                    ? 'true'
                    : 'false'
              "
              :aria-disabled="entry.reason ? 'true' : undefined"
              :data-active="entry.index === active ? '' : undefined"
              class="flex min-h-11 flex-col justify-center rounded-lg px-3 py-2 text-gray-800 data-active:bg-brand-50 data-active:text-brand-800 dark:text-gray-200 dark:data-active:bg-brand-500/15 dark:data-active:text-brand-200"
              :class="
                entry.reason
                  ? 'cursor-not-allowed text-gray-600 dark:text-gray-400'
                  : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5'
              "
              @mousedown.prevent
              @click="choose(entry)"
            >
              <span class="font-medium wrap-anywhere">{{ entry.nameUnicode }}</span>
              <span
                v-if="
                  entry.detail !== undefined ? !!entry.detail : entry.nameUnicode !== entry.name
                "
                class="text-sm wrap-anywhere text-gray-600 dark:text-gray-400"
                >{{ entry.detail !== undefined ? entry.detail : entry.name }}</span
              >
              <span v-if="entry.note" class="text-sm text-gray-600 dark:text-gray-400">{{
                entry.note
              }}</span>
              <span v-if="entry.reason" class="text-sm text-gray-700 dark:text-gray-300">{{
                entry.reason
              }}</span>
            </div>
          </div>
        </template>
      </div>
      <p v-if="searching" role="status" class="text-sm text-gray-700 dark:text-gray-300">
        {{ lt('datatables.loadingRecords') }}
      </p>
      <div
        v-else-if="failed"
        role="alert"
        class="flex flex-wrap items-center gap-3 text-sm text-red-800 dark:text-red-200"
      >
        <span>{{ t('states.list.error') }}</span>
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline', size: 'sm' })"
          @mousedown.prevent
          @click="retry"
        >
          {{ t('common.retry') }}
        </button>
      </div>
      <p v-else-if="noMatch" role="status" class="text-sm text-gray-700 dark:text-gray-300">
        {{ lt('datatables.zeroRecords') }}
      </p>
      <button
        v-if="expanded && more.length > 0"
        type="button"
        data-load-more
        :class="buttonVariants({ variant: 'outline', size: 'sm', class: 'self-start' })"
        :disabled="loadingMore"
        :aria-busy="loadingMore ? 'true' : 'false'"
        @mousedown.prevent
        @click="loadMore"
      >
        {{ t('pickers.loadMore') }}
      </button>
    </div>
  </div>
</template>
