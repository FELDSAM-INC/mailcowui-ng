<script setup lang="ts">
// A form field's classic label, verbatim: through the sanitiser when the value carries HTML
// (`edit.subfolder2`), followed by the imapsync option that the classic labels append (FR-025).
import type { LegacyRef } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'

defineProps<{ text: LegacyRef; option?: string }>()
</script>

<template>
  <LegacyText :k="text.legacy" />{{ option ? ' ' : ''
  }}<code v-if="option" class="text-xs text-gray-600 dark:text-gray-400">({{ option }})</code>
</template>
