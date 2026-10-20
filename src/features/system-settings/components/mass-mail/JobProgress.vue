<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MassMailRecipientCounts } from '@/api'
import { useFormat } from '@/i18n/format'
const props = defineProps<{ counts: MassMailRecipientCounts }>()
const { t } = useI18n(),
  format = useFormat()
const outcomes = ['delivered', 'failed', 'skipped', 'pending'] as const
const colors = {
  delivered: 'fill-green-600',
  failed: 'fill-red-600',
  skipped: 'fill-amber-500',
  pending: 'fill-gray-400',
}
const segments = computed(() => {
  const total = outcomes.reduce((sum, key) => sum + props.counts[key], 0) || 1
  let x = 0
  return outcomes.map((key) => {
    const width = (props.counts[key] / total) * 100,
      start = x
    x += width
    return { key, x: start, width }
  })
})
</script>
<template>
  <div class="space-y-3" data-job-progress>
    <svg
      viewBox="0 0 100 3"
      class="h-3 w-full overflow-hidden rounded-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect
        v-for="part in segments"
        :key="part.key"
        :x="part.x"
        y="0"
        :width="part.width"
        height="3"
        :class="colors[part.key]"
      />
    </svg>
    <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div v-for="outcome in outcomes" :key="outcome">
        <dt>{{ t(`systemSettings.massMail.outcomes.${outcome}`) }}</dt>
        <dd class="text-xl font-semibold">{{ format.number(counts[outcome]) }}</dd>
      </div>
    </dl>
  </div>
</template>
