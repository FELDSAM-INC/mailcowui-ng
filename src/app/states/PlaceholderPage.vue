<script setup lang="ts">
// A section that a later feature delivers (FR-044). It names the section and says that it comes
// in a later version. It requests no data. US3 adds the classic interface links (T091).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PageHeader from '@/shared/components/PageHeader.vue'

import { findEntry } from '../navigation/catalogue'

const props = defineProps<{ entryId: string }>()
const { t } = useI18n()
const entry = computed(() => findEntry(props.entryId))
</script>

<template>
  <section class="mx-auto w-full max-w-3xl">
    <PageHeader :title="entry ? t(entry.labelKey) : ''" />
    <p class="text-gray-700 dark:text-gray-300">{{ t('states.placeholder.body') }}</p>
  </section>
</template>
