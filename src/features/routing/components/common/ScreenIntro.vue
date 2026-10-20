<script setup lang="ts">
// The classic card's hint above a routing list (FR-008), verbatim from the installation's language
// file; values with markup (bold, line breaks, code, the Postfix documentation link) render
// through `SanitizedHtml.vue` (constitution IV 1.3.0, research R20).
import type { LegacyKey } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'

defineProps<{ hint: LegacyKey }>()
</script>

<template>
  <LegacyText
    :k="hint"
    as="p"
    data-screen-intro
    class="text-sm wrap-anywhere text-gray-700 dark:text-gray-300 [&_a]:font-medium [&_a]:text-accent-text [&_a]:bg-white dark:[&_a]:bg-gray-900 [&_a]:underline"
  />
</template>
