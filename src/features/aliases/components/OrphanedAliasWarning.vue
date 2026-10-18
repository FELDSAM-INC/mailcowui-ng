<script setup lang="ts">
// The warning on an orphaned alias (US3-AS7, FR-016), for administrators: its domain no longer
// exists (the API's `orphaned`, which the classic interface cannot show); it can be deleted from
// the list, and a change is saved only together with an address in an existing domain.
import { useI18n } from 'vue-i18n'

import { WarningIcon } from '@/shared/icons'

const { t } = useI18n()
</script>

<template>
  <div
    data-orphaned-warning
    role="note"
    class="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
  >
    <WarningIcon class="mt-0.5 size-5 shrink-0" />
    <p class="min-w-0 break-words">{{ t('aliases.orphaned.warning') }}</p>
  </div>
</template>
