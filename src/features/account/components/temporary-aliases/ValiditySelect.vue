<script setup lang="ts">
import {
  validityLabel,
  validityPresets,
  type AliasValidity,
  type AliasValidityLimits,
} from '../../validity'
defineProps<{ id?: string; limits: AliasValidityLimits; disabled?: boolean }>()
const model = defineModel<AliasValidity>({ required: true })
</script>
<template>
  <select :id="id" v-model="model" name="validity" class="form-control" :disabled="disabled">
    <option v-for="item in validityPresets(limits)" :key="item.value" :value="item.value">
      {{ validityLabel(item.value) }}
    </option>
  </select>
</template>
