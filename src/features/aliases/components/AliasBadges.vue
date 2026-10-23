<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

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
  <Badge v-if="alias.kind === 'catchAll'" data-badge="catchAll" color="gray">{{
    lt('mailbox.catch_all')
  }}</Badge>
  <Badge v-if="canSeeOrphaned && alias.orphaned" data-badge="orphaned" color="warning">{{
    t('aliases.orphaned.badge')
  }}</Badge>
</template>
