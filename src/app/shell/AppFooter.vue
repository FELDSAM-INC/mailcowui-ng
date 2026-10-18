<script setup lang="ts">
// The operator's footer, sanitised (FR-002, FR-042).
import SanitizedHtml from '@/shared/components/SanitizedHtml.vue'

import { useBranding } from '../branding/public-config'

const { branding } = useBranding()
</script>

<template>
  <footer
    v-if="branding.footerHtml"
    class="border-t border-gray-200 px-4 py-6 text-sm break-words text-gray-600 sm:px-6 dark:border-gray-800 dark:text-gray-400 [&_a]:underline [&_a]:underline-offset-2"
  >
    <SanitizedHtml :html="branding.footerHtml" />
  </footer>
</template>
