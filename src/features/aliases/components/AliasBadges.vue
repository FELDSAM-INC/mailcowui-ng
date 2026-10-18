<script setup lang="ts">
// The badges of an alias, as text (FR-012, FR-063): legacy's "Catch-All" (`mailbox.catch_all`),
// and for administrators "orphaned" when its domain no longer exists (the API's `orphaned`, which
// the classic interface cannot show).
import { useI18n } from 'vue-i18n'

import type { Alias } from '@/api'
import { lt } from '@/i18n'

defineProps<{ alias: Alias; canSeeOrphaned: boolean }>()
const { t } = useI18n()
</script>

<template>
  <span
    v-if="alias.kind === 'catchAll' || (canSeeOrphaned && alias.orphaned)"
    class="flex flex-wrap gap-1.5"
  >
    <span
      v-if="alias.kind === 'catchAll'"
      data-badge="catchAll"
      class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-800 dark:bg-white/10 dark:text-gray-200"
      >{{ lt('mailbox.catch_all') }}</span
    >
    <span
      v-if="canSeeOrphaned && alias.orphaned"
      data-badge="orphaned"
      class="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
      >{{ t('aliases.orphaned.badge') }}</span
    >
  </span>
</template>
