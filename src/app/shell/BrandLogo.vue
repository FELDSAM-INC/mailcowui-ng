<script setup lang="ts">
// The operator's logo for the active theme (FR-001, research R16). Without a logo, or when it
// fails to load, the product name is shown as text (spec edge case).
import { ref, watch } from 'vue'

import { useBranding } from '../branding/public-config'

defineProps<{ textClass?: string; compact?: boolean }>()
const { branding, logo } = useBranding()
const failed = ref(false)
watch(logo, () => {
  failed.value = false
})
</script>

<template>
  <img
    v-if="logo && !failed"
    :src="logo"
    :alt="branding.productName"
    class="h-10 w-auto object-contain"
    :class="compact ? 'max-w-11' : 'max-w-[12rem]'"
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
