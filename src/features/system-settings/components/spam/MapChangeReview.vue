<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { reactive } from 'vue'
import { useFormat } from '@/i18n/format'
import PlainText from '@/shared/components/PlainText.vue'
import { buttonVariants } from '@/shared/ui/button'
defineProps<{ added: readonly string[]; removed: readonly string[] }>()
const { t } = useI18n()
const format = useFormat()
const shown = reactive({ added: 100, removed: 100 })
</script>
<template>
  <div data-map-review class="max-h-[40dvh] min-w-0 space-y-4 overflow-y-auto">
    <section
      v-for="[kind, lines] in [
        ['added', added],
        ['removed', removed],
      ] as const"
      :key="kind"
    >
      <h3 class="font-medium">
        {{ t(`systemSettings.filterMaps.${kind}`, { count: format.number(lines.length) }) }}
      </h3>
      <ul
        class="mt-2 max-h-48 space-y-1 overflow-auto rounded border border-gray-200 p-3 font-mono text-sm dark:border-gray-700"
      >
        <li v-for="(line, index) in lines.slice(0, shown[kind])" :key="index">
          <PlainText :value="line || ' '" />
        </li>
      </ul>
      <button
        v-if="lines.length > shown[kind]"
        type="button"
        :class="buttonVariants({ variant: 'outline', size: 'sm' })"
        @click="shown[kind] += 100"
      >
        {{ t('systemSettings.filterMaps.moreLines') }}
      </button>
    </section>
  </div>
</template>
