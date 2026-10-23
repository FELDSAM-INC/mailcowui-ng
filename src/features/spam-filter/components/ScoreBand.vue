<script setup lang="ts">
import { Badge, type BadgeColor } from '@/shared/ui/badge'

// The three zones of the spam score (UI 006 research R17, legacy `templates/user/Spamfilter.twig`):
// in legacy order, each with its range as `js/site/user.js` writes it ("< 8", "8 - 15", "> 15") in
// the user's number format, and legacy's explanation. Above them, a colour bar whose widths are
// bound inline sizes (a bound style, which the CSP allows). The bar is decorative: every zone states
// its range in text, so colour never carries the meaning alone (FR-079).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import { DEFAULT_LOCALE, isAppLocale } from '@/i18n/locales'
import { fromTenths } from '@/i18n/parse'

import { bandZones, type Tenths, type ZoneId } from '../spam-score'

const props = defineProps<{ junk: Tenths; reject: Tenths }>()
const { t, locale } = useI18n()

const zones = computed(() => bandZones(props.junk, props.reject))
const number = (tenths: Tenths) =>
  formatNumber(fromTenths(tenths), isAppLocale(locale.value) ? locale.value : DEFAULT_LOCALE, {
    maximumFractionDigits: 1,
  })
const named = computed(() => ({ junk: number(props.junk), reject: number(props.reject) }))

const BAR: Record<ZoneId, string> = {
  green: 'bg-green-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-500',
}
const BADGE: Record<ZoneId, BadgeColor> = { green: 'success', yellow: 'warning', red: 'error' }
</script>

<template>
  <div data-score-band class="flex flex-col gap-2">
    <div
      aria-hidden="true"
      data-score-bar
      class="flex h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
    >
      <span
        v-for="zone in zones"
        :key="zone.id"
        :data-zone-bar="zone.id"
        :class="BAR[zone.id]"
        :style="{ inlineSize: `${zone.width}%` }"
      />
    </div>
    <ul class="flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
      <li
        v-for="zone in zones"
        :key="zone.id"
        :data-zone="zone.id"
        class="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm text-gray-800 dark:text-gray-200"
      >
        <Badge data-zone-range :color="BADGE[zone.id]"
          ><bdi>{{ t(zone.rangeKey, named) }}</bdi></Badge
        >
        <span class="min-w-0 flex-1 break-words">{{ lt(zone.labelKey) }}</span>
      </li>
    </ul>
  </div>
</template>
