<script setup lang="ts">
// The audit log's active filters (FR-073) through the shared ActiveFilterChips: one chip per
// filter value, removed one by one or all at once.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFormat } from '@/i18n/format'
import ActiveFilterChips, { type FilterChip } from '@/shared/components/ActiveFilterChips.vue'

import { useAuditLabels } from '../labels'
import type { AuditFilterValues } from '../list-state'

const props = defineProps<{ filters: AuditFilterValues }>()
const emit = defineEmits<{ remove: [change: Partial<AuditFilterValues>]; clear: [] }>()

const { t } = useI18n()
const fmt = useFormat()
const { label } = useAuditLabels()

interface AuditChip extends FilterChip {
  change: Partial<AuditFilterValues>
}

const chips = computed<AuditChip[]>(() => {
  const filters = props.filters
  const result: AuditChip[] = []
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
  if (filters.targetType) {
    result.push({
      key: 'targetType',
      label: label('targetType', filters.targetType),
      change: { targetType: undefined },
    })
  }
  if (filters.targetId) {
    result.push({
      key: 'targetId',
      label: t('auditLog.chips.targetId', { id: filters.targetId }),
      change: { targetId: undefined },
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

function remove(key: string) {
  const chip = chips.value.find((item) => item.key === key)
  if (chip) emit('remove', chip.change)
}
</script>

<template>
  <ActiveFilterChips :chips="chips" @remove="remove" @clear="emit('clear')" />
</template>
