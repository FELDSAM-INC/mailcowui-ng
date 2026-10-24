<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { lt } from '@/i18n'
import { ChevronDownIcon } from '@/shared/icons'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '@/shared/ui/dropdown-menu'
import FormField from './FormField.vue'

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    modelValue: readonly string[]
    options: readonly { value: string; label: string }[]
    errors?: readonly string[]
    disabled?: boolean
  }>(),
  { errors: () => [], disabled: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const { t } = useI18n()
const open = ref(false)
const search = ref('')
const selected = computed(() =>
  props.options.filter((option) => props.modelValue.includes(option.value)),
)
const filtered = computed(() =>
  props.options.filter((option) =>
    option.label.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()),
  ),
)
watch(open, () => {
  search.value = ''
})
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) open.value = false
  },
)
function toggle(value: string, checked: boolean) {
  if (props.disabled) return
  emit(
    'update:modelValue',
    checked
      ? [...props.modelValue.filter((item) => item !== value), value]
      : props.modelValue.filter((item) => item !== value),
  )
}
function searchKey(event: KeyboardEvent) {
  if (event.key === 'Escape' || event.key === 'Tab') return
  event.stopPropagation()
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const menu = (event.target as HTMLElement).closest('[role="menu"]')
    const choices = menu?.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]')
    if (choices?.length) choices[event.key === 'ArrowDown' ? 0 : choices.length - 1]?.focus()
  } else if (event.key === 'Enter') event.preventDefault()
}
</script>

<template>
  <FormField :id="id" :label="label" :errors="errors" class="min-w-0" data-multiselect>
    <template #default="control">
      <DropdownMenu v-model:open="open" :modal="false">
        <DropdownMenuTrigger as-child :disabled="disabled">
          <button
            v-bind="control"
            type="button"
            :disabled="disabled"
            class="form-control flex h-auto min-h-11 items-center gap-3 text-start disabled:opacity-60"
            :data-multiselect-trigger="id"
          >
            <span class="min-w-0 flex-1 truncate">
              <template v-if="selected.length"
                >{{
                  selected
                    .slice(0, 2)
                    .map((option) => option.label)
                    .join(', ')
                }}<span v-if="selected.length > 2" class="ms-2 text-muted"
                  >+{{ selected.length - 2 }}</span
                ></template
              >
              <span v-else class="text-muted">{{ t('domains.values.none') }}</span>
            </span>
            <span
              v-if="selected.length"
              class="shrink-0 rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-text"
              >{{ t('bulk.selected', { count: selected.length }) }}</span
            >
            <ChevronDownIcon class="size-4 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          class="w-(--reka-dropdown-menu-trigger-width) min-w-0 max-w-[calc(100vw-2rem)]"
          :aria-label="label"
        >
          <div v-if="options.length > 8" class="relative mb-1 shrink-0">
            <input
              v-model="search"
              type="search"
              :aria-label="lt('datatables.search')"
              :placeholder="lt('datatables.search')"
              class="form-control"
              autocomplete="off"
              @keydown="searchKey"
            />
          </div>
          <div class="max-h-64 min-h-0 overflow-y-auto overscroll-contain divide-y divide-line">
            <DropdownMenuCheckboxItem
              v-for="option in filtered"
              :id="`${id}-${option.value}`"
              :key="option.value"
              :data-multiselect-option="option.value"
              :model-value="modelValue.includes(option.value)"
              :disabled="disabled"
              class="min-h-11 whitespace-normal wrap-anywhere"
              @update:model-value="toggle(option.value, $event === true)"
              @select.prevent
              >{{ option.label }}</DropdownMenuCheckboxItem
            >
            <p v-if="!filtered.length" role="status" class="p-3 text-sm text-muted">
              {{ lt('datatables.zeroRecords') }}
            </p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </template>
  </FormField>
</template>
