<script setup lang="ts">
// Adding a second factor (UI 005 US2, FR-045 to FR-050): the method's legacy title and its setup
// with the current password. After a success the list is refreshed, legacy's message is announced
// and the section opens again.
import { useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { lt, type LegacyKey } from '@/i18n'
import SettingsPage from '@/shared/components/SettingsPage.vue'
import { announce } from '@/shared/composables/useAnnouncer'

import { afterSecondFactorChange } from '../api/second-factors'
import SecurityKeySetup from '../components/two-factor/SecurityKeySetup.vue'
import TotpSetup from '../components/two-factor/TotpSetup.vue'
import YubicoOtpSetup from '../components/two-factor/YubicoOtpSetup.vue'
import { useSectionAccess } from '../composables/useSectionAccess'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const access = useSectionAccess(() => 'twoFactor')

const TITLES: Record<string, LegacyKey> = {
  totp: 'tfa.totp',
  webauthn: 'tfa.webauthn',
  'yubi-otp': 'tfa.yubi_otp',
}
const method = computed(() => String(route.params.method ?? 'totp'))

async function done() {
  afterSecondFactorChange(queryClient)
  announce(lt('success.object_modified', access.identity.data.value?.username ?? ''))
  await router.push({ name: 'account-two-factor' })
}
</script>

<template>
  <SettingsPage :title="lt(TITLES[method] ?? 'tfa.totp')">
    <TotpSetup v-if="method === 'totp'" @done="done" />
    <SecurityKeySetup v-else-if="method === 'webauthn'" @done="done" />
    <YubicoOtpSetup v-else @done="done" />
  </SettingsPage>
</template>
