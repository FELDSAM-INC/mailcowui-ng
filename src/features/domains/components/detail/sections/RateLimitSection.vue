<script setup lang="ts">
// The "Rate limit" tab of the classic domain page (`templates/edit/domain.twig` #dratelimit) in its
// legacy position, read-only until the feature that owns the domain rate limit makes it editable
// (docs/conventions.md "Detail pages"). An empty rate limit reads as the classic placeholder
// "Disabled".
import { computed } from 'vue'
import { lt } from '@/i18n'
import type { Domain } from '@/api'
import EditableSection from '@/shared/components/EditableSection.vue'

import { useDomainFormat } from '../../../format'
import ValueList from '../ValueList.vue'

const props = defineProps<{ domain: Domain }>()
const format = useDomainFormat()
const items = computed(() => [
  {
    key: 'rateLimit',
    label: lt('edit.ratelimit'),
    value: props.domain.rateLimit
      ? `${format.count(props.domain.rateLimit.value)} ${lt(`ratelimit.${props.domain.rateLimit.frame}`)}`
      : lt('ratelimit.disabled'),
  },
])
</script>

<template>
  <EditableSection
    section-id="ratelimit"
    :title="lt('edit.ratelimit')"
    :editable="false"
    :editing="false"
  >
    <ValueList :items="items" />
  </EditableSection>
</template>
