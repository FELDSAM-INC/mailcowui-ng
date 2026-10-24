<script setup lang="ts">
// Desktop uses the operator's logo alone; mobile also shows the product name. If the logo is
// missing or fails to load, the name remains visible at every width.
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
      :alt="branding.productName"
      class="w-auto object-contain"
      :class="[logoSizes.signIn.heightClass, logoSizes.signIn.widthClass]"
      @error="failed = true"
    />
    <p
      data-product-name
      class="max-w-full text-lg font-semibold wrap-anywhere text-gray-900 lg:text-3xl dark:text-white"
      :class="{ 'lg:hidden': logo && !failed }"
      :aria-hidden="logo && !failed ? true : undefined"
    >
      {{ branding.productName }}
    </p>
  </div>
</template>
