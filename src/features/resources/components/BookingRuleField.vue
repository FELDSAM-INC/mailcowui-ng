<script setup lang="ts">
// "Multiple bookings" as the classic resource forms ask for it (`add.multiple_bookings`): legacy's
// select of the three rules, and for "Hard-limit to a custom amount of bookings" the number field
// (whole numbers within the server's range, US7-AS4).
import { lt } from '@/i18n'
import type { ResourceBookingRule } from '@/api'

import { BOOKING_OPTIONS } from '../booking'

withDefaults(
  defineProps<{
    idPrefix: string
    rule: ResourceBookingRule
    limitText: string
    range: { min: number; max: number }
    errors?: readonly string[]
    limitErrors?: readonly string[]
  }>(),
  { errors: () => [], limitErrors: () => [] },
)
const emit = defineEmits<{
  'update:rule': [rule: ResourceBookingRule]
  'update:limitText': [value: string]
}>()

const SELECT =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label
      :for="`${idPrefix}-bookingRule`"
      class="text-sm font-medium text-gray-800 dark:text-gray-200"
    >
      {{ lt('add.multiple_bookings') }}
    </label>
    <select
      :id="`${idPrefix}-bookingRule`"
      :value="rule"
      :class="SELECT"
      :aria-invalid="errors.length > 0 ? 'true' : undefined"
      @change="
        emit('update:rule', ($event.target as HTMLSelectElement).value as ResourceBookingRule)
      "
    >
      <option v-for="option in BOOKING_OPTIONS" :key="option.rule" :value="option.rule">
        {{ lt(option.labelKey) }}
      </option>
    </select>
    <p v-for="message in errors" :key="message" class="text-sm text-red-700 dark:text-red-300">
      {{ message }}
    </p>
    <template v-if="rule === 'limited'">
      <hr class="my-2 border-gray-200 dark:border-gray-800" />
      <input
        :id="`${idPrefix}-bookingLimit`"
        :value="limitText"
        type="number"
        inputmode="numeric"
        step="1"
        :min="range.min"
        :max="range.max"
        :aria-label="lt('mailbox.booking_custom')"
        :aria-invalid="limitErrors.length > 0 ? 'true' : undefined"
        :aria-describedby="limitErrors.length > 0 ? `${idPrefix}-bookingLimit-error` : undefined"
        :class="SELECT"
        @input="emit('update:limitText', ($event.target as HTMLInputElement).value)"
      />
      <div
        v-if="limitErrors.length > 0"
        :id="`${idPrefix}-bookingLimit-error`"
        class="text-sm text-red-700 dark:text-red-300"
      >
        <p v-for="message in limitErrors" :key="message">{{ message }}</p>
      </div>
    </template>
  </div>
</template>
