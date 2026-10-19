<script setup lang="ts">
// "Forgot password?" (UI 005 FR-034, research R12): legacy's `login.forgot_password` to the reset
// request, only when the signed-out capabilities say a reset is possible; nothing while they load,
// when they fail or when the reset is unavailable. Replaces UI 001's link to the classic page.
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { useSelfServiceCapabilities } from '@/features/account'
import LegacyText from '@/shared/components/LegacyText.vue'

const capabilities = useSelfServiceCapabilities()
const available = computed(() => capabilities.data.value?.passwordReset.available === true)
</script>

<template>
  <RouterLink
    v-if="available"
    :to="{ name: 'password-reset-request' }"
    class="text-link self-start"
    data-forgot-password
  >
    <LegacyText k="login.forgot_password" />
  </RouterLink>
</template>
