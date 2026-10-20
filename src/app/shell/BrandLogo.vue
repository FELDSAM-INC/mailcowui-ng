<script setup lang="ts">
// The operator's logo for the active theme (FR-001, research R16). Without a logo, or when it
// fails to load, the product name is shown as text (spec edge case).
import { computed, ref, watch } from 'vue'

import { useBranding } from '../branding/public-config'
import { logoSizes, type LogoSize } from '../branding/logo-sizes'

const props = withDefaults(
  defineProps<{ textClass?: string; compact?: boolean; size?: LogoSize; src?: string | null }>(),
  { size: 'header' },
)
const { branding, logo } = useBranding()
const source = computed(() => (props.src === undefined ? logo.value : props.src))
const failed = ref(false)
watch(source, () => {
  failed.value = false
})
</script>

<template>
  <img
    v-if="source && !failed"
    :src="source"
    :alt="branding.productName"
    class="w-auto object-contain"
    :class="[logoSizes[size].heightClass, compact ? 'max-w-11' : logoSizes[size].widthClass]"
    @error="failed = true"
  />
  <span
    v-else
    class="min-w-0 font-semibold break-words text-gray-900 dark:text-white"
    :class="textClass"
    :aria-label="compact ? branding.productName : undefined"
    >{{ branding.productName }}</span
  >
</template>
