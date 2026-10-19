<script setup lang="ts">
// The buttons of an entry, as the classic tables have them (`process_table_data()` in `admin.js`,
// `draw_*_table()` in `mailbox.js`): "Test" (hard-coded in legacy), Edit and Remove, plus History
// for administrators (conventions "History and audit"). Each button names the entry for screen
// readers, and every target is at least 44 × 44 px (FR-010).
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import { lt } from '@/i18n'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import { TrashIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

withDefaults(
  defineProps<{
    name: string
    /** `admin.*` on the admin page's lists, `mailbox.*` on the mail setup lists. */
    section: 'admin' | 'mailbox'
    editTo?: RouteLocationRaw | null
    testTo?: RouteLocationRaw | null
    removable?: boolean
    history?: { targetType: string; targetId: string } | null
  }>(),
  { editTo: null, testTo: null, removable: false, history: null },
)
const emit = defineEmits<{ remove: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-wrap gap-2 md:justify-end" data-entry-actions>
    <RouterLink
      v-if="testTo"
      :to="testTo"
      :class="buttonVariants({ variant: 'outline', size: 'sm' })"
      :aria-label="`${t('routing.common.test')}: ${name}`"
      data-action="test"
    >
      {{ t('routing.common.test') }}
    </RouterLink>
    <RouterLink
      v-if="editTo"
      :to="editTo"
      :class="buttonVariants({ variant: 'outline', size: 'sm' })"
      :aria-label="`${lt(section === 'admin' ? 'admin.edit' : 'mailbox.edit')}: ${name}`"
      data-action="edit"
    >
      {{ lt(section === 'admin' ? 'admin.edit' : 'mailbox.edit') }}
    </RouterLink>
    <button
      v-if="removable"
      type="button"
      :class="buttonVariants({ variant: 'destructive', size: 'sm' })"
      :aria-label="`${lt(section === 'admin' ? 'admin.remove' : 'mailbox.remove')}: ${name}`"
      data-action="remove"
      @click="emit('remove')"
    >
      <TrashIcon />
      {{ lt(section === 'admin' ? 'admin.remove' : 'mailbox.remove') }}
    </button>
    <HistoryLink
      v-if="history"
      :target-type="history.targetType"
      :target-id="history.targetId"
      :label="t('history.link')"
      :aria-label="`${t('history.link')}: ${name}`"
    />
  </div>
</template>
