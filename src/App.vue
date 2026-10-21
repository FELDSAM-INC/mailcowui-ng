<script setup lang="ts">
// The root component (research R11, R19): the "service unavailable" page while the bootstrap has
// failed, otherwise the layout of the current route (the shell for signed-in pages, the auth
// layout for the sign-in flow; "not found" follows the session), plus the app's single live
// announcer, confirmation host and idle warning.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import LiveAnnouncer from '@/shared/components/LiveAnnouncer.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import { confirmState } from '@/shared/composables/useConfirm'

import { bootstrapStatus } from './app/bootstrap'
import { useBranding } from './app/branding/public-config'
import AuthLayout from './app/layouts/AuthLayout.vue'
import ShellLayout from './app/layouts/ShellLayout.vue'
import { useSessionStore } from './app/session/store'
import IdleWarningDialog from './app/session/IdleWarningDialog.vue'
import { installTitle } from './app/router/title'
import { isSignedIn, useSessionQuery } from './app/session/queries'
import ServiceUnavailablePage from './app/states/ServiceUnavailablePage.vue'

const route = useRoute()
const router = useRouter()
const i18n = useI18n()
const session = useSessionQuery()
const { branding } = useBranding()
const sessionStore = useSessionStore()
const confirmationUsed = ref(false)
const idleWarningUsed = ref(false)
// Closed dialogs need no UI machinery during startup. Keep each host after first use so its
// closing animation and focus restoration can finish; timers and requests live outside the host.
watch(
  confirmState,
  (request) => {
    if (request) confirmationUsed.value = true
  },
  { immediate: true },
)
watch(
  () => sessionStore.idleWarningOpen,
  (open) => {
    if (open) idleWarningUsed.value = true
  },
  { immediate: true },
)

const layout = computed(() => {
  if (route.meta.layout) return route.meta.layout
  return isSignedIn(session.data.value) ? 'shell' : 'auth'
})

installTitle(router, {
  t: (key, named) => (named ? i18n.t(key, named) : i18n.t(key)),
  pageTitle: () => branding.value.pageTitle,
  actingUsername: () => session.data.value?.impersonation?.target.username,
  dependencies: [
    () => i18n.locale.value,
    () => branding.value.pageTitle,
    () => session.data.value?.impersonation?.id,
  ],
})
</script>

<template>
  <ServiceUnavailablePage v-if="bootstrapStatus === 'unavailable'" />
  <template v-else-if="bootstrapStatus === 'ready' && route.matched.length > 0">
    <ShellLayout v-if="layout === 'shell'" />
    <AuthLayout v-else />
  </template>
  <LiveAnnouncer />
  <ConfirmDialog v-if="confirmationUsed" />
  <IdleWarningDialog v-if="bootstrapStatus === 'ready' && idleWarningUsed" />
</template>
