<script setup lang="ts">
// The log choice (FR-030; plan decision 5): legacy's log dropdown as a native <select> labelled
// `debug.logs`, with legacy's three groups as <optgroup>s and its log names in its order. Choosing a
// log opens its address; Rspamd has its own screen.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useBranding } from '@/app/branding/public-config'
import { lt } from '@/i18n'

import { LOG_TYPES } from '../log-types'

const props = defineProps<{ current: string }>()
const { t } = useI18n()
const router = useRouter()
const { branding } = useBranding()

const name = (key: string) => t(key, { productName: branding.value.productName })
const inMemory = computed(() => LOG_TYPES.filter((type) => type.group === 'inMemory'))
const stored = computed(() => LOG_TYPES.filter((type) => type.group === 'stored'))

function choose(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === props.current) return
  void router.push(
    value === 'rspamd'
      ? { name: 'operations-rspamd' }
      : { name: 'operations-log', params: { logType: value } },
  )
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label for="operations-log-type" class="text-sm font-medium text-gray-800 dark:text-gray-200">
      {{ lt('debug.logs') }}
    </label>
    <select
      id="operations-log-type"
      :value="current"
      class="h-11 w-full max-w-sm rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
      @change="choose"
    >
      <optgroup :label="lt('debug.in_memory_logs')">
        <option v-for="type in inMemory" :key="type.slug" :value="type.slug">
          {{ name(type.titleKey) }}
        </option>
      </optgroup>
      <optgroup :label="lt('debug.external_logs')">
        <option value="rspamd">{{ t('operations.logs.types.rspamd') }}</option>
      </optgroup>
      <optgroup :label="lt('debug.static_logs')">
        <option v-for="type in stored" :key="type.slug" :value="type.slug">
          {{ name(type.titleKey) }}
        </option>
      </optgroup>
    </select>
  </div>
</template>
