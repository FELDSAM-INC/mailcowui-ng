<script setup lang="ts">
// Both list layouts render message data through the same inert-text boundary.
import type { QuarantineItem } from '@/api'
import { useFormat } from '@/i18n/format'
import DateTime from '@/shared/components/DateTime.vue'
import PlainText from '@/shared/components/PlainText.vue'

import type { QuarantineSort } from '../../list-state'
import ActionBadge from '../ActionBadge.vue'
import NotifiedBadge from '../NotifiedBadge.vue'
import VirusBadge from '../VirusBadge.vue'

defineProps<{ item: QuarantineItem; field: QuarantineSort }>()
const fmt = useFormat()
</script>

<template>
  <ActionBadge v-if="field === 'action'" :item="item" />
  <VirusBadge v-else-if="field === 'virus'" :virus="item.virus" />
  <NotifiedBadge v-else-if="field === 'notified'" :notified="item.notified" />
  <DateTime v-else-if="field === 'arrivedAt'" :value="item.arrivedAt" />
  <span v-else-if="field === 'score'" class="tabular-nums">
    {{ item.score === null ? '-' : fmt.number(item.score) }}
  </span>
  <span v-else-if="field === 'id'" class="tabular-nums">{{ item.id }}</span>
  <PlainText v-else :value="item[field] || '-'" />
</template>
