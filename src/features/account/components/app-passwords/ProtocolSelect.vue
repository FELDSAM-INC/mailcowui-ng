<script setup lang="ts">
// Legacy uses a multi-select, with its six choices in this order (plan D13).
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AppPasswordProtocol } from '@/api'
import { lt } from '@/i18n'
import { APP_PASSWORD_PROTOCOL_ORDER, appPasswordProtocolKey } from '../../labels'
const model = defineModel<AppPasswordProtocol[]>({ required: true })
defineProps<{ editing?: boolean; disabled?: boolean }>()
const id = useId()
const { t } = useI18n()
</script>
<template>
  <div class="flex flex-col gap-2">
    <label :for="id" class="text-sm font-medium text-gray-800 dark:text-gray-200">{{
      lt(editing ? 'edit.app_passwd_protocols' : 'add.app_passwd_protocols')
    }}</label>
    <select
      :id="id"
      v-model="model"
      multiple
      size="6"
      :disabled="disabled"
      class="form-control min-h-44"
    >
      <option
        v-for="protocol in APP_PASSWORD_PROTOCOL_ORDER"
        :key="protocol"
        :value="protocol"
        class="min-h-11 py-3"
      >
        {{ t(appPasswordProtocolKey(protocol)) }}
      </option>
    </select>
    <p v-if="model.length === 0" role="status" class="text-sm text-amber-800 dark:text-amber-200">
      {{ t('account.appPasswords.noProtocol') }}
    </p>
  </div>
</template>
