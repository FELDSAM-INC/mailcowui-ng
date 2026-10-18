<script setup lang="ts">
// The active filters as removable chips (FR-073): one by one, or all at once. Each chip's
// accessible name starts with "Remove filter" and contains its visible text.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFormat } from '@/i18n/format'
import { CloseIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { useAuditLabels } from '../labels'
import type { AuditFilterValues } from '../list-state'

const props = defineProps<{ filters: AuditFilterValues }>()
const emit = defineEmits<{ remove: [change: Partial<AuditFilterValues>]; clear: [] }>()

const { t } = useI18n()
const fmt = useFormat()
const { label } = useAuditLabels()

interface Chip {
  key: string
  label: string
  change: Partial<AuditFilterValues>
}

const chips = computed<Chip[]>(() => {
  const filters = props.filters
  const result: Chip[] = []
  if (filters.range) {
    const text =
      filters.range === 'custom'
        ? t('auditLog.chips.custom', {
            from: filters.from ? fmt.dateTime(filters.from) : '…',
            to: filters.to ? fmt.dateTime(filters.to) : '…',
          })
        : t(`auditLog.filters.ranges.${filters.range}`)
    result.push({
      key: 'range',
      label: text,
      change: { range: undefined, from: undefined, to: undefined },
    })
  }
  for (const type of filters.event) {
    result.push({
      key: `event-${type}`,
      label: label('eventType', type),
      change: { event: filters.event.filter((value) => value !== type) },
    })
  }
  if (filters.outcome) {
    result.push({
      key: 'outcome',
      label: label('outcome', filters.outcome),
      change: { outcome: undefined },
    })
  }
  if (filters.actor) {
    result.push({
      key: 'actor',
      label: t('auditLog.chips.actor', { value: filters.actor }),
      change: { actor: undefined },
    })
  }
  if (filters.address) {
    result.push({
      key: 'address',
      label: t('auditLog.chips.address', { value: filters.address }),
      change: { address: undefined },
    })
  }
  return result
})
</script>

<template>
  <section
    v-if="chips.length > 0"
    :aria-label="t('auditLog.chips.label')"
    class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
  >
    <ul class="flex flex-wrap gap-2">
      <li v-for="chip in chips" :key="chip.key" class="min-w-0 max-w-full">
        <button
          type="button"
          :aria-label="t('auditLog.chips.remove', { filter: chip.label })"
          class="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-gray-300 bg-white px-3 text-sm text-gray-800 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/5"
          @click="emit('remove', chip.change)"
        >
          <span class="min-w-0 wrap-anywhere">{{ chip.label }}</span>
          <CloseIcon class="size-4 shrink-0" />
        </button>
      </li>
    </ul>
    <button
      type="button"
      :class="buttonVariants({ variant: 'ghost', class: 'self-start' })"
      @click="emit('clear')"
    >
      {{ t('auditLog.chips.clearAll') }}
    </button>
  </section>
</template>
