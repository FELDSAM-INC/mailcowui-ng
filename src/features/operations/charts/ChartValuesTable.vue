<script setup lang="ts">
// The table alternative of a live chart (FR-083): one row per sample with its collection time to
// the second and one column per series, with header cells and a caption.
import { computed } from 'vue'

import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import { toBcp47 } from '@/i18n/locales'

import type { ChartSample } from './scale'

const props = defineProps<{
  caption: string
  series: readonly { name: string }[]
  samples: readonly ChartSample[]
  format: (value: number) => string
}>()
const fmt = useFormat()
const time = computed(
  () => new Intl.DateTimeFormat(toBcp47(fmt.locale.value), { timeStyle: 'medium' }),
)
</script>

<template>
  <div class="max-w-full overflow-x-auto">
    <table class="w-full text-start text-sm">
      <caption class="sr-only">
        {{
          caption
        }}
      </caption>
      <thead>
        <tr class="border-b border-gray-200 dark:border-gray-800">
          <th scope="col" class="px-2 py-1 text-start font-medium">{{ lt('admin.time') }}</th>
          <th
            v-for="item in props.series"
            :key="item.name"
            scope="col"
            class="px-2 py-1 text-end font-medium"
          >
            {{ item.name }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="sample in samples"
          :key="sample.t"
          class="border-b border-gray-100 last:border-0 dark:border-gray-800"
        >
          <th scope="row" class="px-2 py-1 text-start font-normal tabular-nums">
            <time :datetime="sample.t">{{ time.format(new Date(sample.t)) }}</time>
          </th>
          <td
            v-for="(value, index) in sample.values"
            :key="index"
            class="px-2 py-1 text-end tabular-nums"
          >
            {{ value === null ? '-' : format(value) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
