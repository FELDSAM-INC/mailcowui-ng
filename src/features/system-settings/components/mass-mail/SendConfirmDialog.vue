<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { MassMailJobCreateRequest } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
defineProps<{ message: MassMailJobCreateRequest; summary: string }>()
const { t } = useI18n(),
  format = useFormat()
</script>
<template>
  <div class="space-y-4" data-send-confirm>
    <dl class="grid min-w-0 gap-2">
      <dt class="font-medium">{{ lt('admin.from') }}</dt>
      <dd class="wrap-anywhere">{{ message.sender }}</dd>
      <dt class="font-medium">{{ lt('admin.subject') }}</dt>
      <dd class="wrap-anywhere">{{ message.subject }}</dd>
      <dt class="font-medium">{{ lt('admin.recipients') }}</dt>
      <dd class="wrap-anywhere">{{ summary }}</dd>
    </dl>
    <p>
      {{
        t(
          'systemSettings.massMail.count',
          { count: format.number(message.expectedRecipients) },
          message.expectedRecipients,
        )
      }}
    </p>
    <p>{{ t('systemSettings.massMail.confirmNote') }}</p>
  </div>
</template>
