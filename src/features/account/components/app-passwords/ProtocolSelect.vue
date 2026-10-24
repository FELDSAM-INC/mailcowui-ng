<script setup lang="ts">
// Legacy uses a multi-select, with its six choices in this order (plan D13).
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AppPasswordProtocol } from '@/api'
import { lt } from '@/i18n'
import MultiSelect from '@/shared/components/MultiSelect.vue'
import { APP_PASSWORD_PROTOCOL_ORDER, appPasswordProtocolKey } from '../../labels'
const model = defineModel<AppPasswordProtocol[]>({ required: true })
defineProps<{ editing?: boolean; disabled?: boolean }>()
const id = useId()
const { t } = useI18n()
const options = computed(() =>
  APP_PASSWORD_PROTOCOL_ORDER.map((value) => ({ value, label: t(appPasswordProtocolKey(value)) })),
)
</script>
<template>
  <div class="flex flex-col gap-2">
    <MultiSelect
      :id="id"
      :model-value="model"
      :options="options"
      :label="lt(editing ? 'edit.app_passwd_protocols' : 'add.app_passwd_protocols')"
      :disabled="disabled"
      @update:model-value="model = $event as AppPasswordProtocol[]"
    />
    <p v-if="model.length === 0" role="status" class="text-sm text-amber-800 dark:text-amber-200">
      {{ t('account.appPasswords.noProtocol') }}
    </p>
  </div>
</template>
