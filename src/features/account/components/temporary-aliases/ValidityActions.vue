<script setup lang="ts">
import { useId } from 'vue'
import { lt } from '@/i18n'
import {
  validityLabel,
  validityPresets,
  type AliasValidity,
  type AliasValidityLimits,
} from '../../validity'
defineProps<{ limits: AliasValidityLimits; disabled?: boolean; address?: string }>()
const emit = defineEmits<{ change: [value: AliasValidity] }>()
const id = useId()
function changed(event: Event) {
  const select = event.target as HTMLSelectElement
  if (select.value) emit('change', select.value as AliasValidity)
  select.value = ''
}
</script>
<template>
  <label :for="id" class="sr-only"
    >{{ lt('mailbox.quick_actions') }}{{ address ? `: ${address}` : '' }}</label
  >
  <select :id="id" class="form-control max-w-full" :disabled="disabled" @change="changed">
    <option value="">{{ lt('mailbox.quick_actions') }}</option>
    <option v-for="item in validityPresets(limits)" :key="item.value" :value="item.value">
      {{ validityLabel(item.value, true) }}
    </option>
  </select>
</template>
