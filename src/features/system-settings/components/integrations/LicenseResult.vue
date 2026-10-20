<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { LicenseStatus } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
defineProps<{ result: LicenseStatus['lastVerification'] }>()
const { t } = useI18n(),
  format = useFormat()
</script>
<template>
  <dl data-license-result class="flex flex-col gap-3">
    <div>
      <dt class="font-medium">{{ t('systemSettings.license.result') }}</dt>
      <dd>{{ t(`systemSettings.license.results.${result.result}`) }}</dd>
    </div>
    <div v-if="result.verifiedAt">
      <dt class="font-medium">{{ t('systemSettings.license.verifiedAt') }}</dt>
      <dd>
        <time :datetime="result.verifiedAt">{{ format.dateTime(result.verifiedAt) }}</time>
      </dd>
    </div>
    <div v-if="result.customerId !== null">
      <dt class="font-medium">{{ lt('admin.customer_id') }}</dt>
      <dd class="break-all">{{ result.customerId }}</dd>
    </div>
    <div v-if="result.serviceId !== null">
      <dt class="font-medium">{{ lt('admin.service_id') }}</dt>
      <dd class="break-all">{{ result.serviceId }}</dd>
    </div>
    <div v-if="result.supportLevel !== null">
      <dt class="font-medium">{{ t('systemSettings.license.supportLevel') }}</dt>
      <dd>{{ format.number(result.supportLevel) }}</dd>
    </div>
  </dl>
</template>
