<script setup lang="ts">
// The layout of the sign-in flow (research R4: adapted from TailAdmin's AuthLayout): the
// announcement, a centred column for the page and the operator's footer. Language and theme
// choice arrive with US6 (T121).
import { RouterView } from 'vue-router'

import AnnouncementBanner from '../shell/AnnouncementBanner.vue'
import AppFooter from '../shell/AppFooter.vue'
import SkipLink from '../shell/SkipLink.vue'
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-gray-50 dark:bg-gray-950">
    <SkipLink />
    <AnnouncementBanner />
    <main
      id="main"
      tabindex="-1"
      class="flex w-full flex-1 flex-col items-center px-4 py-8 focus:outline-none sm:py-12"
    >
      <div class="w-full max-w-md">
        <RouterView />
      </div>
    </main>
    <AppFooter />
  </div>
</template>
