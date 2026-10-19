<script setup lang="ts">
// The names of "all names without a key" in its confirmation (FR-024): the first 10 and a count of
// the others, and whether the current search and type filter narrowed them.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { namePreview, type RunName } from '../dkim/generate-run'

const props = defineProps<{ names: readonly RunName[]; filtered: boolean }>()
const { t } = useI18n()
const preview = computed(() => namePreview(props.names))
</script>

<template>
  <div data-name-preview class="flex flex-col gap-2">
    <p v-if="filtered">{{ t('dns.dkim.allMissing.filters') }}</p>
    <ul class="list-disc ps-5 break-all">
      <li v-for="name in preview.shown" :key="name">{{ name }}</li>
    </ul>
    <p v-if="preview.more > 0">{{ t('dns.dkim.generate.namesMore', { count: preview.more }) }}</p>
  </div>
</template>
