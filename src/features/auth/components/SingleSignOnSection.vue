<script setup lang="ts">
// The single sign-on part of the sign-in screens (UI 012 FR-040 to FR-043, legacy form map): the
// classic "or login with" divider unless it would stand alone, the start's problem, and the
// button. A separate chunk, loaded only when single sign-on is offered (constitution VII): the
// sign-in screens of servers without it never load the start, the kept address or the URL checks.
import { watch } from 'vue'
import { useRoute } from 'vue-router'

import type { ApiProblem } from '@/api'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'

import { useSingleSignOnStart } from '../composables/useSingleSignOnStart'
import OrDivider from './OrDivider.vue'
import SingleSignOnButton from './SingleSignOnButton.vue'

defineProps<{ divider: boolean }>()
const emit = defineEmits<{ starting: []; problem: [problem: ApiProblem | null] }>()
const route = useRoute()

// UI 012: single sign-on keeps the requested page for after the round trip (FR-043).
const sso = useSingleSignOnStart({
  returnTo: () => route.query.returnTo,
  onStart: () => emit('starting'),
})
// The page keeps showing "not offered" after this section is gone (FR-043).
watch(sso.problem, (problem) => emit('problem', problem))
</script>

<template>
  <OrDivider v-if="divider" data-other-logins>
    <LegacyText k="login.other_logins" />
  </OrDivider>
  <ProblemMessage :problem="sso.problem.value" />
  <SingleSignOnButton :pending="sso.pending.value" @start="sso.start" />
</template>
