<script setup lang="ts">
// The signed-in shell (FR-042–FR-046, research R19, R21; adapted from TailAdmin's AdminLayout):
// header, the navigation (a static list from lg, a drawer below), the announcement, the main
// content and the operator's footer. A section the catalogue denies renders NoAccessState in
// place of the route component, so no section data is requested (FR-045).
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { useStatusMessage } from '@/shared/composables/useStatusMessage'
import { CloseIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { defaultLandingPath } from '../navigation/landing'
import { usePreferencesStore } from '../preferences/store'
import ThemeToggle from '../preferences/ThemeToggle.vue'
import { routeAccess } from '../router/guards'
import { useIdentityQuery } from '../session/queries'
import { useSignOut } from '../session/sign-out'
import { useBranding } from '../branding/public-config'
const { branding } = useBranding()
import AnnouncementBanner from '../shell/AnnouncementBanner.vue'
import AppFooter from '../shell/AppFooter.vue'
import AppHeader from '../shell/AppHeader.vue'
const AppsMenu = defineAsyncComponent(() => import('../shell/AppsMenu.vue'))
import BrandLogo from '../shell/BrandLogo.vue'
import NavigationDrawer from '../shell/NavigationDrawer.vue'
import NavigationList from '../shell/NavigationList.vue'
import SectionTabs from '../shell/SectionTabs.vue'
import SkipLink from '../shell/SkipLink.vue'
const UserMenu = defineAsyncComponent(() => import('../shell/UserMenu.vue'))
import IdentityTransition from '../shell/IdentityTransition.vue'
import ShellNotice from '../shell/ShellNotice.vue'
import StickyHeader from '../shell/StickyHeader.vue'
const ActingBanner = defineAsyncComponent(() => import('../shell/ActingBanner.vue'))
import { useSessionStore } from '../session/store'
import NoAccessState from '../states/NoAccessState.vue'

const { t } = useI18n()
const session = useSessionStore()
const route = useRoute()
const wide = useMediaQuery('(min-width: 1024px)')
const identityQuery = useIdentityQuery()
const identity = computed(() => (session.identityTransition ? undefined : identityQuery.data.value))
// A known identity can link directly to its landing page, avoiding a second leave confirmation
// when the guarded root route redirects. An unresolved identity still uses the guarded root.
const homePath = computed(() => (identity.value ? defaultLandingPath(identity.value) : '/'))
const allowed = computed(() => routeAccess(route, identity.value) === 'allowed')

const drawerOpen = ref(false)
const drawerUsed = ref(false)
watch(drawerOpen, (open) => {
  if (open) drawerUsed.value = true
})
const sidebarCollapsed = ref(false)
const header = ref<{ menuButton: HTMLButtonElement | null } | null>(null)
const menuButton = computed(() => header.value?.menuButton ?? null)

const { signOut, retry, pending: signingOut, failed: signOutFailed } = useSignOut()
const preferences = usePreferencesStore()

// UI 011 (research R8, R22): app-level status messages, listed by a component loaded with the first.
const StatusMessageHost = defineAsyncComponent(() => import('../shell/StatusMessageHost.vue'))
const statusMessages = useStatusMessage().messages
</script>

<template>
  <div class="flex min-h-dvh bg-gray-50 dark:bg-gray-950">
    <SkipLink />
    <aside
      v-if="wide"
      id="desktop-navigation"
      data-desktop-sidebar
      :data-collapsed="sidebarCollapsed"
      class="sticky top-0 flex h-dvh shrink-0 flex-col self-start border-e border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
      :class="sidebarCollapsed ? 'w-[90px]' : 'w-[290px]'"
    >
      <RouterLink
        :to="homePath"
        data-shell-logo
        data-sidebar-logo
        class="flex h-24 shrink-0 items-center rounded-lg px-5 focus-visible:outline-2 focus-visible:outline-brand-500"
        :class="sidebarCollapsed ? 'justify-center' : ''"
      >
        <BrandLogo :compact="sidebarCollapsed" />
      </RouterLink>
      <div
        data-sidebar-scroll
        class="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6"
      >
        <NavigationList :identity="identity" :collapsed="sidebarCollapsed" />
      </div>
    </aside>
    <NavigationDrawer
      v-if="!wide && drawerUsed"
      v-model:open="drawerOpen"
      :identity="identity"
      :return-focus="menuButton"
    />
    <div class="flex min-w-0 flex-1 flex-col">
      <StickyHeader>
        <ActingBanner v-if="identity?.impersonation" :impersonation="identity.impersonation" />
        <AppHeader
          ref="header"
          :desktop="wide"
          :home-path="homePath"
          :menu-open="wide ? !sidebarCollapsed : drawerOpen"
          @open-menu="wide ? (sidebarCollapsed = !sidebarCollapsed) : (drawerOpen = true)"
        >
          <template #actions>
            <ThemeToggle />
            <AppsMenu v-if="identity" :username="identity.username" />
            <UserMenu
              v-if="identity"
              :identity="identity"
              :signing-out="signingOut"
              @sign-out="signOut"
            />
          </template>
        </AppHeader>
      </StickyHeader>
      <main id="main" tabindex="-1" class="min-w-0 flex-1 px-4 py-6 focus:outline-none sm:px-6">
        <div class="mx-auto w-full max-w-7xl min-w-0" data-shell-content>
          <AnnouncementBanner v-if="branding.announcement" class="mb-6 rounded-xl border" />
          <div
            v-if="signOutFailed"
            role="alert"
            class="mb-6 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 sm:flex-row sm:items-center dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            <p class="flex-1">{{ t('shell.signOutFailed') }}</p>
            <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="retry">
              {{ t('common.retry') }}
            </button>
          </div>
          <div
            v-if="preferences.saveMessage"
            role="alert"
            class="mb-6 flex items-start gap-3 rounded-xl border border-warning-200 bg-warning-50 p-4 text-warning-900 dark:border-warning-900 dark:bg-warning-950 dark:text-warning-100"
          >
            <p class="min-w-0 flex-1">{{ t(`preferences.${preferences.saveMessage}`) }}</p>
            <button
              type="button"
              class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-current dark:hover:bg-white/10"
              :aria-label="t('common.close')"
              @click="preferences.saveMessage = null"
            >
              <CloseIcon class="size-5" />
            </button>
          </div>
          <div
            role="status"
            data-status-messages
            class="empty:hidden"
            :class="statusMessages.length ? 'mb-6' : ''"
          >
            <StatusMessageHost v-if="statusMessages.length" />
          </div>
          <ShellNotice />
          <SectionTabs v-if="allowed && !session.identityTransition" :identity="identity" />
          <div data-page-content>
            <IdentityTransition v-if="session.identityTransition" />
            <RouterView v-else-if="allowed" />
            <NoAccessState v-else />
          </div>
        </div>
      </main>
      <AppFooter />
    </div>
  </div>
</template>

<style scoped>
/* The shell owns page width. Only route roots are normalised; table overflow and form internals
   keep their own layout and scrolling. */
[data-page-content] > :deep(*) {
  width: 100%;
  max-width: none;
}
</style>
