<script setup lang="ts">
// The signed-in shell (FR-042–FR-046, research R19, R21; adapted from TailAdmin's AdminLayout):
// header, the navigation (a static list from lg, a drawer below), the announcement, the main
// content and the operator's footer. A section the catalogue denies renders NoAccessState in
// place of the route component, so no section data is requested (FR-045).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute } from 'vue-router'

import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { buttonVariants } from '@/shared/ui/button'

import { routeAccess } from '../router/guards'
import { useIdentityQuery } from '../session/queries'
import { useSignOut } from '../session/sign-out'
import AnnouncementBanner from '../shell/AnnouncementBanner.vue'
import AppFooter from '../shell/AppFooter.vue'
import AppHeader from '../shell/AppHeader.vue'
import AppsMenu from '../shell/AppsMenu.vue'
import NavigationDrawer from '../shell/NavigationDrawer.vue'
import NavigationList from '../shell/NavigationList.vue'
import SkipLink from '../shell/SkipLink.vue'
import UserMenu from '../shell/UserMenu.vue'
import NoAccessState from '../states/NoAccessState.vue'

const { t } = useI18n()
const route = useRoute()
const wide = useMediaQuery('(min-width: 1024px)')
const identityQuery = useIdentityQuery()
const identity = computed(() => identityQuery.data.value)
const allowed = computed(() => routeAccess(route, identity.value) === 'allowed')

const drawerOpen = ref(false)
const header = ref<{ menuButton: HTMLButtonElement | null } | null>(null)
const menuButton = computed(() => header.value?.menuButton ?? null)

const { signOut, retry, pending: signingOut, failed: signOutFailed } = useSignOut()
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-gray-50 dark:bg-gray-950">
    <SkipLink />
    <AppHeader
      ref="header"
      :show-menu-button="!wide"
      :menu-open="drawerOpen"
      @open-menu="drawerOpen = true"
    >
      <template #actions>
        <AppsMenu v-if="identity" :username="identity.username" />
        <UserMenu
          v-if="identity"
          :identity="identity"
          :signing-out="signingOut"
          @sign-out="signOut"
        />
      </template>
    </AppHeader>
    <NavigationDrawer
      v-if="!wide"
      v-model:open="drawerOpen"
      :identity="identity"
      :return-focus="menuButton"
    />
    <AnnouncementBanner />
    <div class="flex w-full flex-1">
      <aside
        v-if="wide"
        class="w-72 shrink-0 border-e border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
      >
        <NavigationList :identity="identity" />
      </aside>
      <main id="main" tabindex="-1" class="min-w-0 flex-1 px-4 py-6 focus:outline-none sm:px-6">
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
        <RouterView v-if="allowed" />
        <NoAccessState v-else />
      </main>
    </div>
    <AppFooter />
  </div>
</template>
