<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

// The list switch below `md` (UI 006 FR-045, research R19; legacy form map screen 5): the
// Allowlist or the Denylist, each named by its legacy heading with its number of entries, as a
// segmented radio group. From `md` up both lists are shown and the switch is hidden. The choice is
// kept in the address (`list`).
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SpamPolicyList } from '@/api'
import { lt, type LegacyKey } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'

defineProps<{
  modelValue: SpamPolicyList
  /** The number of entries of each list (own and read-only), once known. */
  counts: Partial<Record<SpamPolicyList, number>>
}>()
const emit = defineEmits<{ 'update:modelValue': [list: SpamPolicyList] }>()
const { locale } = useI18n()
const name = `policy-list-${useId()}`

const OPTIONS: { list: SpamPolicyList; label: LegacyKey }[] = [
  { list: 'allow', label: 'user.spamfilter_wl' },
  { list: 'block', label: 'user.spamfilter_bl' },
]
</script>

<template>
  <fieldset data-list-switch class="md:hidden">
    <legend class="sr-only">{{ lt('acl.spam_policy') }}</legend>
    <div class="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
      <label
        v-for="option in OPTIONS"
        :key="option.list"
        :data-list-option="option.list"
        class="relative flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium text-gray-700 has-checked:bg-white has-checked:text-gray-900 has-checked:shadow-theme-xs has-focus-visible:outline-2 has-focus-visible:outline-brand-500 dark:text-gray-300 dark:has-checked:bg-gray-900 dark:has-checked:text-white"
      >
        <input
          type="radio"
          class="sr-only"
          :name="name"
          :value="option.list"
          :checked="modelValue === option.list"
          @change="emit('update:modelValue', option.list)"
        />
        <span class="break-words">{{ lt(option.label) }}</span>
        <Badge v-if="counts[option.list] !== undefined" color="gray">{{
          formatNumber(counts[option.list]!, locale as AppLocale)
        }}</Badge>
      </label>
    </div>
  </fieldset>
</template>
