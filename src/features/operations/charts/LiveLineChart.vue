<script setup lang="ts">
// A live line chart without a chart library (research R7, FR-005, FR-010, FR-083, FR-084): a
// figure with a visible caption, the current values in text, an inline SVG image with a title and
// a text summary, at most two series (the second dashed, with a legend naming each pattern, so
// they never differ by colour alone), and a table alternative. It fits any width (fixed view box,
// non-scaling strokes), uses the chart colour tokens through classes and never a style attribute,
// and has no transition or animation. Until two samples with values exist it says
// `datatables.loadingRecords`, as legacy's spinner does. It is loaded as its own chunk.
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'

import { SERIES_LENGTH } from '../live/useLiveSeries'
import ChartValuesTable from './ChartValuesTable.vue'
import {
  points,
  scaleMax,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  type ChartKind,
  type ChartSample,
} from './scale'
import { useOperationsFormat } from '../format'

const props = defineProps<{
  caption: string
  series: readonly { name: string }[]
  samples: readonly ChartSample[]
  kind: ChartKind
}>()

const { t } = useI18n()
const fmt = useFormat()
const opsFmt = useOperationsFormat()
const id = useId()
const showTable = ref(false)

function format(value: number): string {
  return props.kind === 'percent'
    ? fmt.number(value / 100, { style: 'percent', maximumFractionDigits: 1 })
    : opsFmt.rate(value)
}

const valued = computed(() =>
  props.samples.filter((sample) => sample.values.some((v) => v !== null)),
)
const ready = computed(() => valued.value.length >= 2)
const max = computed(() =>
  scaleMax(
    props.kind,
    props.samples.flatMap((sample) => sample.values),
  ),
)

const lines = computed(() =>
  props.series.map((_, index) =>
    points(
      props.samples.map((sample) => sample.values[index] ?? null),
      max.value,
      SERIES_LENGTH,
    )
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' '),
  ),
)

const stats = computed(() =>
  props.series.map((item, index) => {
    const values = props.samples
      .map((sample) => sample.values[index] ?? null)
      .filter((value): value is number => value !== null)
    return {
      name: item.name,
      current: values.at(-1) ?? null,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      count: values.length,
    }
  }),
)

const summary = computed(() =>
  stats.value
    .filter((stat) => stat.current !== null)
    .map((stat) =>
      t('operations.charts.summary', {
        series: stat.name,
        value: format(stat.current!),
        min: format(stat.min!),
        max: format(stat.max!),
        count: stat.count,
      }),
    )
    .join(' '),
)

const DASH = '6 4'
const STROKES = ['stroke-chart-1', 'stroke-chart-2'] as const
</script>

<template>
  <figure class="flex min-w-0 flex-col gap-2" data-live-chart>
    <figcaption class="font-medium text-gray-800 dark:text-gray-200">{{ caption }}</figcaption>
    <p v-if="!ready" class="text-sm text-gray-600 dark:text-gray-400" data-collecting>
      {{ lt('datatables.loadingRecords') }}
    </p>
    <template v-else>
      <ul data-current class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <li v-for="stat in stats" :key="stat.name">
          <span class="text-gray-600 dark:text-gray-400">{{ stat.name }}</span>
          {{ ' ' }}
          <span class="font-medium tabular-nums">{{
            stat.current === null ? '-' : format(stat.current)
          }}</span>
        </li>
      </ul>
      <div class="flex gap-2">
        <div
          class="flex flex-col justify-between text-end text-xs text-gray-600 tabular-nums dark:text-gray-400"
          aria-hidden="true"
        >
          <span>{{ format(max) }}</span>
          <span>{{ format(0) }}</span>
        </div>
        <svg
          role="img"
          :aria-labelledby="`${id}-title ${id}-desc`"
          :viewBox="`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`"
          preserveAspectRatio="none"
          class="h-28 min-w-0 flex-1 overflow-visible rounded border border-gray-200 dark:border-gray-800"
        >
          <title :id="`${id}-title`">{{ caption }}</title>
          <desc :id="`${id}-desc`">{{ summary }}</desc>
          <line
            :x1="0"
            :x2="VIEW_WIDTH"
            :y1="VIEW_HEIGHT / 2"
            :y2="VIEW_HEIGHT / 2"
            class="stroke-gray-200 dark:stroke-gray-800"
            stroke-width="1"
            vector-effect="non-scaling-stroke"
          />
          <polyline
            v-for="(line, index) in lines"
            :key="index"
            :data-series="index"
            :points="line"
            fill="none"
            :class="STROKES[index]"
            stroke-width="2"
            stroke-linejoin="round"
            :stroke-dasharray="index === 1 ? DASH : undefined"
            vector-effect="non-scaling-stroke"
          />
        </svg>
      </div>
      <ul v-if="series.length > 1" data-legend class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <li v-for="(item, index) in series" :key="item.name" class="flex items-center gap-2">
          <svg viewBox="0 0 24 4" class="h-1 w-6" aria-hidden="true">
            <line
              x1="0"
              x2="24"
              y1="2"
              y2="2"
              :class="STROKES[index]"
              stroke-width="3"
              :stroke-dasharray="index === 1 ? '4 3' : undefined"
            />
          </svg>
          {{ item.name }}
        </li>
      </ul>
      <div>
        <button
          type="button"
          class="inline-flex min-h-11 items-center text-sm font-medium text-brand-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
          :aria-expanded="showTable"
          :aria-controls="`${id}-table`"
          @click="showTable = !showTable"
        >
          {{ showTable ? t('operations.charts.hideTable') : t('operations.charts.showTable') }}
        </button>
        <div v-if="showTable" :id="`${id}-table`">
          <ChartValuesTable
            :caption="caption"
            :series="series"
            :samples="samples"
            :format="format"
          />
        </div>
      </div>
    </template>
  </figure>
</template>
