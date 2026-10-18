<script setup lang="ts">
// A boolean cell as the classic tables show it: legacy's ✓ or ✕ (`mailbox.yes`, `mailbox.no`), with
// "Yes" or "No" for screen readers, so the state is never shown by a glyph alone (FR-063).
import { useI18n } from 'vue-i18n'

import LegacyText from '@/shared/components/LegacyText.vue'

defineProps<{ value: boolean }>()
const { t } = useI18n()
</script>

<template>
  <span class="inline-flex items-center">
    <LegacyText :k="value ? 'mailbox.yes' : 'mailbox.no'" aria-hidden="true" />
    <span class="sr-only">{{ value ? t('lists.filters.yes') : t('lists.filters.no') }}</span>
  </span>
</template>
