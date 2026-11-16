<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { text } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import NetworkListField from '../components/NetworkListField.vue'
import type { KeyCreate } from './api'
const form = defineModel<KeyCreate>({ required: true })
defineProps<{ errorsFor: (path: string) => string[] }>()
const { t } = useI18n()
</script>
<template>
  <div class="grid gap-4 md:grid-cols-2">
    <FormField
      id="legacy-key-description"
      v-slot="control"
      :label="t('legacyKeys.fields.description')"
      :errors="errorsFor('description')"
      ><input v-bind="control" v-model="form.description" maxlength="255" class="form-control"
    /></FormField>
    <FormField
      id="legacy-key-accessLevel"
      v-slot="control"
      :label="t('legacyKeys.fields.accessLevel')"
      :errors="errorsFor('accessLevel')"
      ><select v-bind="control" v-model="form.accessLevel" class="form-control">
        <option value="readOnly">{{ text('enums.apiKeyAccessLevel.readOnly') }}</option>
        <option value="readWrite">{{ text('enums.apiKeyAccessLevel.readWrite') }}</option>
      </select></FormField
    >
    <FormField
      v-for="field in ['active', 'skipIpCheck'] as const"
      :id="`legacy-key-${field}`"
      :key="field"
      v-slot="control"
      :label="t(`legacyKeys.fields.${field}`)"
      :errors="errorsFor(field)"
      ><input
        v-bind="control"
        v-model="form[field]"
        type="checkbox"
        class="size-4 accent-brand-500"
    /></FormField>
  </div>
  <FormField
    id="legacy-key-allowedNetworks"
    :label="t('legacyKeys.fields.allowedNetworks')"
    :description="t('legacyKeys.networkHelp')"
    :errors="errorsFor('allowedNetworks')"
    ><NetworkListField
      id-prefix="legacy-key-allowedNetworks"
      :model-value="form.allowedNetworks ?? []"
      :errors-for="errorsFor"
      @update:model-value="form.allowedNetworks = $event"
  /></FormField>
</template>
