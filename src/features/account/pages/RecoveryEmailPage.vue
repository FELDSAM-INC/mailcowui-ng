<script setup lang="ts">
// My account › Password recovery email (UI 005 US3, FR-032; legacy `#pwRecoveryEmailModal`).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf } from '@/api'
import { lt } from '@/i18n'
import SettingsPage from '@/shared/components/SettingsPage.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'

import { useOwnRecoveryEmail } from '../api/recovery-email'
import RecoveryEmailForm from '../components/recovery/RecoveryEmailForm.vue'
import { useSectionAccess } from '../composables/useSectionAccess'

const { t } = useI18n()
const access = useSectionAccess(() => 'recoveryEmail')
const query = useOwnRecoveryEmail()
const username = computed(() => access.identity.data.value?.username ?? '')
</script>

<template>
  <SettingsPage :title="lt('user.pw_recovery_email')">
    <div v-if="query.isPending.value" role="status" aria-busy="true">
      {{ lt('footer.loading') }}
    </div>
    <div v-else-if="!query.data.value" class="flex flex-col gap-2">
      <p class="font-medium text-gray-900 dark:text-white">{{ t('states.detail.error') }}</p>
      <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
    </div>
    <RecoveryEmailForm
      v-else
      :stored="query.data.value"
      :username="username"
      @reload="query.refetch()"
    />
  </SettingsPage>
</template>
