<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'
// The filter's result of an item (UI 006 FR-019, FR-022, legacy form map screen 2): legacy's
// heading `quarantine.rspamd_result`, the score with the action badge ("<score> - <label>", or "-"
// without a score), then the symbols in legacy's order, each "NAME (+5.1)" with its score signed in
// text and its options listed below it (legacy shows them only in a tooltip). Symbol names and
// options are data: PlainText.
import { computed } from 'vue'

import type { QuarantineItemDetails } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import PlainText from '@/shared/components/PlainText.vue'

import { formatSymbolScore, sortSymbols } from '../../symbols'
import ActionBadge from '../ActionBadge.vue'
import ExpandableText from './ExpandableText.vue'

const props = defineProps<{
  item: Pick<QuarantineItemDetails, 'score' | 'action' | 'filterAction' | 'symbols'>
}>()
const fmt = useFormat()
const symbols = computed(() => sortSymbols(props.item.symbols))
const tone = (score: number) => (score > 0 ? 'error' : score < 0 ? 'success' : 'gray')
</script>

<template>
  <section data-filter-result aria-labelledby="qitem-result" class="flex flex-col gap-3">
    <h2 id="qitem-result" class="text-lg font-semibold text-gray-900 dark:text-white">
      {{ lt('quarantine.rspamd_result') }}
    </h2>
    <p class="flex flex-wrap items-center gap-2 text-gray-900 dark:text-white">
      <span>{{ lt('quarantine.spam_score') }}:</span>
      <span data-score class="font-semibold tabular-nums">{{
        item.score === null ? '-' : fmt.number(item.score)
      }}</span>
      <span aria-hidden="true">-</span>
      <ActionBadge :item="item" />
    </p>
    <ul v-if="symbols.length > 0" data-symbols class="flex flex-wrap gap-2">
      <li
        v-for="(symbol, index) in symbols"
        :key="index"
        data-symbol
        class="max-w-full min-w-0 text-sm text-ink"
      >
        <Badge :color="tone(symbol.score)"
          ><span
            ><span class="font-mono"><PlainText :value="symbol.name" /></span> (<span
              data-symbol-score
              class="tabular-nums"
              >{{ formatSymbolScore(symbol.score, fmt.locale.value) }}</span
            >)</span
          ></Badge
        >
        <ul
          v-if="symbol.options.length > 0"
          data-symbol-options
          class="mt-1 flex flex-col gap-0.5 text-xs text-gray-700 dark:text-gray-300"
        >
          <li v-for="(option, position) in symbol.options" :key="position">
            <ExpandableText :value="option" />
          </li>
        </ul>
      </li>
    </ul>
  </section>
</template>
