<script setup lang="ts">
// The layout of the sign-in flow (research R4: adapted from TailAdmin's AuthLayout): the
// split desktop form/branding panels, a single mobile column, and shared preference menus.
// On pending-actions screens the choices apply on this device only (FR-058).
import { defineAsyncComponent } from 'vue'
import { useIdentityQuery, useSessionQuery } from '../session/queries'
import StickyHeader from '../shell/StickyHeader.vue'
import { RouterView } from 'vue-router'
import IdentityTransition from '../shell/IdentityTransition.vue'
import ShellNotice from '../shell/ShellNotice.vue'
import { useSessionStore } from '../session/store'
const session = useSessionStore()
const routeSession = useSessionQuery()
const identity = useIdentityQuery(() => !!routeSession.data.value?.impersonation)
const ActingBanner = defineAsyncComponent(() => import('../shell/ActingBanner.vue'))

import LanguageSelect from '../preferences/LanguageSelect.vue'
import ThemeSelect from '../preferences/ThemeSelect.vue'

import { useBranding } from '../branding/public-config'
const { branding } = useBranding()
import AnnouncementBanner from '../shell/AnnouncementBanner.vue'
import AppFooter from '../shell/AppFooter.vue'
import AuthBranding from '../shell/AuthBranding.vue'
import SkipLink from '../shell/SkipLink.vue'
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-white dark:bg-gray-900">
    <SkipLink />
    <StickyHeader v-if="identity.data.value?.impersonation"
      ><ActingBanner :impersonation="identity.data.value.impersonation"
    /></StickyHeader>
    <AnnouncementBanner v-if="branding.announcement" />
    <main
      id="main"
      data-auth-layout
      tabindex="-1"
      class="grid min-w-0 flex-1 grid-cols-1 grid-rows-[auto_auto_1fr] focus:outline-none lg:grid-cols-2 lg:grid-rows-[auto_1fr]"
    >
      <div class="order-1 px-4 py-4 sm:px-8 lg:col-start-1 lg:row-start-1 lg:px-12 lg:py-6">
        <div
          data-auth-preferences
          class="mx-auto flex w-full max-w-md items-center justify-end gap-2"
        >
          <LanguageSelect />
          <ThemeSelect />
        </div>
      </div>
      <div
        data-auth-branding
        class="relative order-2 flex min-w-0 items-center justify-center overflow-hidden px-4 py-5 sm:px-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-s lg:border-gray-200 lg:bg-gray-50 lg:p-12 dark:lg:border-gray-800 dark:lg:bg-gray-950"
      >
        <div
          aria-hidden="true"
          class="auth-grid pointer-events-none absolute inset-0 hidden lg:block"
        />
        <AuthBranding class="relative w-full max-w-md lg:gap-6" />
      </div>
      <div
        class="order-3 flex min-w-0 items-center justify-center px-4 pt-4 pb-8 sm:px-8 lg:col-start-1 lg:row-start-2 lg:px-12 lg:py-10"
      >
        <div data-auth-content class="w-full max-w-md">
          <ShellNotice />
          <IdentityTransition v-if="session.identityTransition" />
          <RouterView v-else />
        </div>
      </div>
    </main>
    <AppFooter />
  </div>
</template>

<style scoped>
.auth-grid {
  background-image:
    linear-gradient(var(--color-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--color-line) 1px, transparent 1px);
  background-size: 52px 52px;
  mask-image: linear-gradient(135deg, #0006, transparent 40%, transparent 60%, #0006);
}
</style>
