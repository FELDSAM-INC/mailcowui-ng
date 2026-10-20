<script setup lang="ts">
// The root component (research R11, R19): the "service unavailable" page while the bootstrap has
// failed, otherwise the layout of the current route (the shell for signed-in pages, the auth
// layout for the sign-in flow; "not found" follows the session), plus the app's single live
// announcer, confirmation host and idle warning.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import LiveAnnouncer from '@/shared/components/LiveAnnouncer.vue'

import { bootstrapStatus } from './app/bootstrap'
import { useBranding } from './app/branding/public-config'
import AuthLayout from './app/layouts/AuthLayout.vue'
import ShellLayout from './app/layouts/ShellLayout.vue'
import IdleWarningDialog from './app/session/IdleWarningDialog.vue'
import { installTitle } from './app/router/title'
import { isSignedIn, useSessionQuery } from './app/session/queries'
import ServiceUnavailablePage from './app/states/ServiceUnavailablePage.vue'

const route = useRoute()
const router = useRouter()
const i18n = useI18n()
const session = useSessionQuery()
const { branding } = useBranding()

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
  <ConfirmDialog />
  <IdleWarningDialog v-if="bootstrapStatus === 'ready'" />
</template>
