<script setup lang="ts">
// The operator's logo for the active theme and the product name (FR-001, research R16). The name
// is always shown as text, so the logo is decorative; when it fails to load, it disappears and the
// name stays (spec edge case).
import { ref, watch } from 'vue'

import { useBranding } from '@/app/branding/public-config'
import { logoSizes } from '@/app/branding/logo-sizes'

const { branding, logo } = useBranding()
const failed = ref(false)
watch(logo, () => {
  failed.value = false
})
</script>

<template>
  <div class="flex flex-col items-center gap-3 text-center">
    <img
      v-if="logo && !failed"
      :src="logo"
      alt=""
      class="w-auto object-contain"
      :class="[logoSizes.signIn.heightClass, logoSizes.signIn.widthClass]"
      @error="failed = true"
    />
    <p
      data-product-name
      class="max-w-full text-lg font-semibold wrap-anywhere text-gray-900 lg:text-3xl dark:text-white"
    >
      {{ branding.productName }}
    </p>
  </div>
</template>
