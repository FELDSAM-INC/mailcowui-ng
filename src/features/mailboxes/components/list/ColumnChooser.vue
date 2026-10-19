<script setup lang="ts">
// The column chooser of the wide list (FR-008): legacy's row details (`className: 'none'`) as
// checkbox items, so that they can be shown as columns. The choice is a device convenience
// (`columns.ts`).
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import { ListIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

import { COLUMNS, type ColumnId } from '../../columns'

const props = defineProps<{ modelValue: readonly ColumnId[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: ColumnId[]] }>()
const { t } = useI18n()

const OPTIONAL = COLUMNS.filter((column) => !column.default)

function toggle(id: ColumnId, checked: boolean) {
  const next = new Set(props.modelValue)
  if (checked) next.add(id)
  else next.delete(id)
  emit(
    'update:modelValue',
    OPTIONAL.map((column) => column.id).filter((item) => next.has(item)),
  )
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger :class="buttonVariants({ variant: 'outline' })">
      <ListIcon />
      {{ t('mailboxes.columns.label') }}
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="max-h-[70vh] overflow-y-auto">
      <DropdownMenuCheckboxItem
        v-for="column in OPTIONAL"
        :key="column.id"
        class="min-h-11"
        :data-column-option="column.id"
        :model-value="modelValue.includes(column.id)"
        @update:model-value="(checked) => toggle(column.id, checked === true)"
        @select.prevent
      >
        {{ column.label ? lt(column.label) : column.text }}
      </DropdownMenuCheckboxItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
