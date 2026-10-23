<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { LogoSetting } from '@/api'
import BrandLogo from '@/app/shell/BrandLogo.vue'
import { logoSizes } from '@/app/branding/logo-sizes'
defineProps<{ src: string | null; variant: LogoSetting['variant'] }>()
const { t } = useI18n()
</script>
<template>
  <div
    class="min-w-0 space-y-3 rounded-xl border p-3"
    :class="
      variant === 'dark'
        ? 'border-gray-700 bg-gray-950 text-white'
        : 'border-gray-200 bg-white text-gray-900'
    "
    :data-logo-preview="variant"
  >
    <p class="text-sm font-medium">{{ t(`systemSettings.logos.${variant}Surface`) }}</p>
    <figure v-for="size in ['header', 'signIn'] as const" :key="size" class="min-w-0 space-y-2">
      <figcaption class="text-xs">
        {{ t(`systemSettings.logos.${size}Size`, logoSizes[size]) }}
      </figcaption>
      <BrandLogo
        :src="src"
        :size="size"
        :text-class="variant === 'dark' ? 'text-white!' : 'text-gray-900!'"
      />
    </figure>
  </div>
</template>
