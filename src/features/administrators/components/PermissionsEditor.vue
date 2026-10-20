<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { DomainAdminPermissionName, DomainAdminPermissions } from '@/api'
import { resolveText } from '@/i18n'
import { Switch } from '@/shared/ui/switch'
import { permissionOrder, permissionLabels } from '../permissions'
const props = defineProps<{
  modelValue: DomainAdminPermissions
  idPrefix: string
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: DomainAdminPermissions] }>()
const { t } = useI18n()
function update(name: DomainAdminPermissionName, value: boolean) {
  emit('update:modelValue', { ...props.modelValue, [name]: value })
}
</script>
<template>
  <div class="flex flex-col gap-1">
    <div
      v-for="flag in permissionOrder"
      :key="flag"
      class="flex min-h-11 items-center justify-between gap-6 py-2"
    >
      <label
        :for="`${idPrefix}-${flag}`"
        class="min-w-0 text-sm text-gray-800 dark:text-gray-200"
        >{{ resolveText(permissionLabels[flag], t) }}</label
      >
      <Switch
        :id="`${idPrefix}-${flag}`"
        :model-value="modelValue[flag]"
        :disabled="disabled"
        @update:model-value="update(flag, $event)"
      />
    </div>
  </div>
</template>
