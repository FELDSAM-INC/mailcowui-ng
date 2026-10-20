<script setup lang="ts">
// The layout of the sign-in flow (research R4: adapted from TailAdmin's AuthLayout): the
// announcement, the language and theme choices (FR-058; on the pending-actions screen they apply
// on this device only), a centred column for the page and the operator's footer.
import { RouterView } from 'vue-router'
import IdentityTransition from '../shell/IdentityTransition.vue'
import ShellNotice from '../shell/ShellNotice.vue'
import { useSessionStore } from '../session/store'
const session = useSessionStore()

import LanguageSelect from '../preferences/LanguageSelect.vue'
import ThemeSelect from '../preferences/ThemeSelect.vue'

import AnnouncementBanner from '../shell/AnnouncementBanner.vue'
import AppFooter from '../shell/AppFooter.vue'
import SkipLink from '../shell/SkipLink.vue'
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-gray-50 dark:bg-gray-950">
    <SkipLink />
    <AnnouncementBanner />
    <div class="flex flex-wrap items-center justify-end gap-3 px-4 pt-3 sm:px-6">
      <LanguageSelect />
      <ThemeSelect />
    </div>
    <main
      id="main"
      tabindex="-1"
      class="flex w-full flex-1 flex-col items-center px-4 py-6 focus:outline-none sm:py-10"
    >
      <div class="w-full max-w-md">
        <ShellNotice />
        <IdentityTransition v-if="session.identityTransition" />
        <RouterView v-else />
      </div>
    </main>
    <AppFooter />
  </div>
</template>
