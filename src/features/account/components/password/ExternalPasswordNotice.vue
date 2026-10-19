<script setup lang="ts">
// A mailbox whose password lives in an external identity provider (UI 005 FR-002, spec edge case;
// decision D15): the password section explains it and offers no form.
import { useI18n } from 'vue-i18n'

import { InfoIcon } from '@/shared/icons'

const { t } = useI18n()
</script>

<template>
  <div
    data-external-password
    class="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-800 dark:border-gray-800 dark:bg-white/5 dark:text-gray-200"
  >
    <InfoIcon class="mt-0.5 size-5 shrink-0" />
    <p>{{ t('problem.password-managed-externally') }}</p>
  </div>
</template>
