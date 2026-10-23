<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'
import { useRecordNavigation } from '@/shared/composables/useRecordNavigation'
const props = defineProps<{ to?: RouteLocationRaw | null; label?: string }>()
const navigation = useRecordNavigation(() => props.to)
const { t } = useI18n()
</script>
<template>
  <tr
    v-bind="navigation"
    :aria-label="to && label ? t('domains.list.detailsOf', { name: label }) : undefined"
  >
    <slot />
  </tr>
</template>
