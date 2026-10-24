<script setup lang="ts">
// The encryption policy of the classic forms: "Enforce TLS incoming" and "Enforce TLS outgoing"
// as two toggles under `user.tls_policy`. Read-only on the mailbox page until UI 005.
import { lt } from '@/i18n'
import ChoiceButton from '@/shared/components/ChoiceButton.vue'

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
  <fieldset class="flex min-w-0 flex-col gap-3">
    <legend class="mb-3 font-semibold text-gray-900 dark:text-white">
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
      <ChoiceButton
        v-for="option in OPTIONS"
        :id="`${idPrefix}-${option.key}`"
        :key="option.key"
        :pressed="valueOf(option.key)"
        @click="
          option.key === 'inbound'
            ? emit('update:inbound', !inbound)
            : emit('update:outbound', !outbound)
        "
        >{{ lt(option.labelKey) }}</ChoiceButton
      >
    </div>
  </fieldset>
</template>
