<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DomainAdminPermissions } from '@/api'
import { lt, resolveText } from '@/i18n'
import MultiSelect from '@/shared/components/MultiSelect.vue'
import { permissionOrder, permissionLabels } from '../permissions'
const props = defineProps<{
  modelValue: DomainAdminPermissions
  idPrefix: string
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: DomainAdminPermissions] }>()
const { t } = useI18n()
const options = computed(() =>
  permissionOrder.map((value) => ({ value, label: resolveText(permissionLabels[value], t) })),
)
const selected = computed(() => permissionOrder.filter((value) => props.modelValue[value]))
function update(values: string[]) {
  emit('update:modelValue', {
    ...props.modelValue,
    ...Object.fromEntries(permissionOrder.map((name) => [name, values.includes(name)])),
  })
}
</script>
<template>
  <MultiSelect
    :id="idPrefix"
    :label="lt('edit.acl')"
    :model-value="selected"
    :options="options"
    :disabled="disabled"
    @update:model-value="update"
  />
</template>
