<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { retryIdentitySwitch } from '../session/identity-switch'
import { useSessionStore } from '../session/store'
const { t } = useI18n()
const session = useSessionStore()
</script>
<template>
  <section data-identity-transition class="flex flex-col gap-4">
    <p role="status" :aria-busy="!session.identityTransitionProblem">
      {{ t('session.switching') }}
    </p>
    <ProblemMessage
      :problem="session.identityTransitionProblem"
      retry
      @retry="retryIdentitySwitch"
    />
  </section>
</template>
