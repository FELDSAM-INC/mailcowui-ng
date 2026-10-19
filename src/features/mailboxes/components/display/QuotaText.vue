<script setup lang="ts">
// Legacy's "Quota" column: the storage used and the quota, "∞" for unlimited (`humanFileSize`
// sizes in binary units for the user's language).
import { computed } from 'vue'

import { useFormat } from '@/i18n/format'

const props = defineProps<{ used: number; quota: number }>()
const fmt = useFormat()
const total = computed(() => (props.quota === 0 ? '∞' : fmt.bytes(props.quota)))
</script>

<template>
  <span class="tabular-nums">{{ `${fmt.bytes(used)}/${total}` }}</span>
</template>
