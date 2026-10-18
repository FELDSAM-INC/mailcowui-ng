<script setup lang="ts">
// The encryption policy of the classic forms: "Enforce TLS incoming" and "Enforce TLS outgoing"
// as two toggles under `user.tls_policy`. Read-only on the mailbox page until UI 005.
import { lt } from '@/i18n'

const props = withDefaults(
  defineProps<{ idPrefix: string; inbound: boolean; outbound: boolean; readonly?: boolean }>(),
  { readonly: false },
)
const emit = defineEmits<{
  'update:inbound': [value: boolean]
  'update:outbound': [value: boolean]
}>()
const OPTIONS = [
  { key: 'inbound', labelKey: 'user.tls_enforce_in' },
  { key: 'outbound', labelKey: 'user.tls_enforce_out' },
] as const
const valueOf = (key: 'inbound' | 'outbound') =>
  key === 'inbound' ? props.inbound : props.outbound
</script>

<template>
  <fieldset class="flex min-w-0 flex-col gap-2">
    <legend class="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
      {{ lt('user.tls_policy') }}
    </legend>
    <ul
      v-if="readonly"
      :data-value="idPrefix"
      class="flex flex-wrap gap-x-4 text-sm text-gray-900 dark:text-white"
    >
      <li v-for="option in OPTIONS.filter((item) => valueOf(item.key))" :key="option.key">
        {{ lt(option.labelKey) }}
      </li>
    </ul>
    <div v-else class="flex flex-wrap gap-2">
      <label
        v-for="option in OPTIONS"
        :key="option.key"
        class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm text-gray-800 has-checked:border-brand-500 has-checked:bg-brand-50 has-checked:text-brand-800 dark:border-gray-700 dark:text-gray-200 dark:has-checked:bg-brand-500/15 dark:has-checked:text-brand-200"
      >
        <input
          :id="`${idPrefix}-${option.key}`"
          type="checkbox"
          class="size-4 accent-brand-500"
          :checked="valueOf(option.key)"
          @change="
            option.key === 'inbound'
              ? emit('update:inbound', ($event.target as HTMLInputElement).checked)
              : emit('update:outbound', ($event.target as HTMLInputElement).checked)
          "
        />
        {{ lt(option.labelKey) }}
      </label>
    </div>
  </fieldset>
</template>
