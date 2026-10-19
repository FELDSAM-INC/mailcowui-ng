<script setup lang="ts">
// One value of a log entry (FR-031 to FR-034, FR-042): times to the second in the device's time
// zone, untrusted texts through `PlainText` (multi-line ones keep their line breaks), legacy's
// placeholders for missing values, the priority as stored with its severity class as colour and
// icon, the watchdog trend with its sign and an arrow, and the rate limit reset (`admin.reset_limit`)
// for an entry whose hash names a bucket.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import type { AppLocale } from '@/i18n/locales'
import PlainText from '@/shared/components/PlainText.vue'
import { DangerIcon, InfoIcon, TrashIcon, WarningIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'
import { RATE_LIMIT_BUCKET_ID_PATTERN } from '@/shared/validation/limits'

import { formatLogTime } from '../log-time'
import type { LogCell, Message } from '../log-types'
import LogBadge from './LogBadge.vue'
import { ArrowDownIcon, ArrowUpIcon } from '../../icons'

const props = defineProps<{ cell: LogCell }>()
defineEmits<{ reset: [hash: string] }>()
const { t, locale } = useI18n()

const message = (value: Message) => t(value.key, value.params ?? {})
const canReset = computed(
  () =>
    props.cell.kind === 'reset' &&
    props.cell.hash !== null &&
    RATE_LIMIT_BUCKET_ID_PATTERN.test(props.cell.hash),
)
</script>

<template>
  <time v-if="cell.kind === 'time'" :datetime="cell.value" class="whitespace-nowrap tabular-nums">{{
    formatLogTime(cell.value, locale as AppLocale)
  }}</time>
  <template v-else-if="cell.kind === 'text' || cell.kind === 'multiline'">
    <PlainText
      v-if="cell.value !== null"
      :value="cell.value"
      :multiline="cell.kind === 'multiline'"
    />
    <span v-else-if="cell.fallback">{{ message(cell.fallback) }}</span>
  </template>
  <template v-else-if="cell.kind === 'code'">
    <code v-if="cell.value !== null" class="font-mono text-xs"
      ><PlainText :value="cell.value"
    /></code>
    <span v-else-if="cell.fallback">{{ message(cell.fallback) }}</span>
  </template>
  <span v-else-if="cell.kind === 'list'" class="flex flex-col">
    <PlainText v-for="(value, index) in cell.values" :key="index" :value="value" />
  </span>
  <LogBadge
    v-else-if="cell.kind === 'priority'"
    data-priority
    :data-severity="cell.severity ?? undefined"
    :tone="
      cell.severity === 'error'
        ? 'danger'
        : cell.severity === 'warning'
          ? 'warning'
          : cell.severity === 'info'
            ? 'info'
            : 'neutral'
    "
  >
    <DangerIcon v-if="cell.severity === 'error'" class="size-3.5 shrink-0" />
    <WarningIcon v-else-if="cell.severity === 'warning'" class="size-3.5 shrink-0" />
    <InfoIcon v-else-if="cell.severity === 'info'" class="size-3.5 shrink-0" />
    <PlainText :value="cell.value" />
  </LogBadge>
  <LogBadge
    v-else-if="cell.kind === 'trend' && cell.value !== null"
    data-trend
    :tone="cell.value < 0 ? 'danger' : cell.value > 0 ? 'success' : 'info'"
  >
    <ArrowDownIcon v-if="cell.value < 0" class="size-3.5 shrink-0" />
    <ArrowUpIcon v-else-if="cell.value > 0" class="size-3.5 shrink-0" />
    {{ cell.value > 0 ? `+${cell.value}` : String(cell.value) }}
  </LogBadge>
  <LogBadge v-else-if="cell.kind === 'badge'" :tone="cell.tone">
    <PlainText v-if="typeof cell.value === 'string'" :value="cell.value" />
    <template v-else>{{ message(cell.value) }}</template>
  </LogBadge>
  <button
    v-else-if="cell.kind === 'reset' && canReset"
    type="button"
    data-reset
    :class="buttonVariants({ variant: 'outline', size: 'sm' })"
    @click="$emit('reset', cell.hash!)"
  >
    <TrashIcon />
    {{ lt('admin.reset_limit') }}
  </button>
</template>
