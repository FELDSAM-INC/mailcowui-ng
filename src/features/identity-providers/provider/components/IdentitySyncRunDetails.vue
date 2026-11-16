<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IdentitySyncRun } from '../synchronisation-api'
const props = defineProps<{ run: IdentitySyncRun }>()
const i18n = useI18n()
const { t } = i18n
const counts = computed(() =>
  Object.entries(props.run.summary?.counts ?? {}).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number',
  ),
)
const details = computed(() =>
  Object.entries(props.run.summary?.details ?? {}).flatMap(([key, value]) =>
    Array.isArray(value)
      ? [{ key, entries: value.filter((item): item is string => typeof item === 'string') }]
      : [],
  ),
)
const errors = computed(() =>
  [
    props.run.summary?.error,
    ...(Array.isArray(props.run.summary?.errors) ? props.run.summary.errors : []),
  ].filter((value): value is string => typeof value === 'string'),
)
function label(key: string) {
  const path = `identitySync.summary.${key}`
  return i18n.te(path) ? t(path) : key.replaceAll('_', ' ')
}
</script>
<template>
  <div class="flex flex-col gap-3 text-sm">
    <p v-if="!run.summary">{{ t('identitySync.noSummary') }}</p>
    <p v-if="run.summary?.blocked" class="text-danger">{{ t('identitySync.blockedHelp') }}</p>
    <p v-for="(error, index) in errors" :key="index" class="break-words text-danger">{{ error }}</p>
    <dl class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div v-for="[key, value] in counts" :key="key">
        <dt class="text-muted">{{ label(key) }}</dt>
        <dd>{{ value }}</dd>
      </div>
    </dl>
    <div v-for="detail in details.filter((item) => item.entries.length)" :key="detail.key">
      <h4 class="font-medium">{{ label(detail.key) }}</h4>
      <ul class="list-inside list-disc break-words">
        <li v-for="(entry, index) in detail.entries" :key="index">{{ entry }}</li>
      </ul>
    </div>
  </div>
</template>
