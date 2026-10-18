<script setup lang="ts">
// The rate limit as the classic forms ask for it (`mailbox/rl-frame.twig`, owner rule 1:1): one
// whole number, empty for none (the placeholder says "Disabled"), and the frame. Promoted from
// UI 002 at its second use (UI 003's mailbox and template forms); UI 004 adds `frames`, the frames
// the caller's capabilities offer.
import { useI18n } from 'vue-i18n'

import { lt, type LegacyKey } from '@/i18n'

export type RateLimitFrame = 'second' | 'minute' | 'hour' | 'day'

const props = withDefaults(
  defineProps<{
    idPrefix: string
    value: string
    frame: RateLimitFrame
    /** The frames the server offers, in its order. */
    frames?: readonly RateLimitFrame[]
    /** `edit.ratelimit`; the add forms say `acl.ratelimit`. */
    labelKey?: LegacyKey
    errors?: readonly string[]
  }>(),
  {
    frames: () => ['second', 'minute', 'hour', 'day'],
    labelKey: 'edit.ratelimit',
    errors: () => [],
  },
)
const emit = defineEmits<{
  'update:value': [value: string]
  'update:frame': [frame: RateLimitFrame]
}>()
const { t } = useI18n()
const FRAME_KEYS: Record<RateLimitFrame, LegacyKey> = {
  second: 'ratelimit.second',
  minute: 'ratelimit.minute',
  hour: 'ratelimit.hour',
  day: 'ratelimit.day',
}
</script>

<template>
  <fieldset class="flex min-w-0 flex-col gap-1.5">
    <legend class="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
      {{ lt(labelKey) }}
    </legend>
    <div class="flex gap-2">
      <input
        :id="`${idPrefix}-value`"
        :value="props.value"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        autocomplete="off"
        :placeholder="lt('ratelimit.disabled')"
        :aria-label="t('forms.rateLimit.value')"
        :aria-invalid="errors.length > 0 ? 'true' : undefined"
        :aria-describedby="errors.length > 0 ? `${idPrefix}-error` : undefined"
        class="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        @input="emit('update:value', ($event.target as HTMLInputElement).value)"
      />
      <select
        :id="`${idPrefix}-frame`"
        :value="frame"
        :aria-label="t('forms.rateLimit.frame')"
        class="h-11 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        @change="emit('update:frame', ($event.target as HTMLSelectElement).value as RateLimitFrame)"
      >
        <option v-for="option in frames" :key="option" :value="option">
          {{ lt(FRAME_KEYS[option]) }}
        </option>
      </select>
    </div>
    <div
      v-if="errors.length > 0"
      :id="`${idPrefix}-error`"
      class="text-sm text-red-700 dark:text-red-300"
    >
      <p v-for="(message, index) in errors" :key="index">{{ message }}</p>
    </div>
  </fieldset>
</template>
