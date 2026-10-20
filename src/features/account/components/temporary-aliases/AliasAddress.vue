<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CopyButton from '@/shared/components/CopyButton.vue'
defineProps<{ address: string }>()
const { t } = useI18n()
const target = ref<HTMLElement | null>(null)
</script>
<template>
  <span class="flex min-w-0 flex-wrap items-center gap-2">
    <span ref="target" class="min-w-0 wrap-anywhere">{{ address }}</span>
    <CopyButton
      :text="address"
      :label="`${t('secrets.copy')}: ${address}`"
      :select-target="target"
    />
  </span>
</template>
