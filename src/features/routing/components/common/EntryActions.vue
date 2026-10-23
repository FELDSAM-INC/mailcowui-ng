<script setup lang="ts">
// Entry actions use a direct control for one available action and a menu for multiple actions.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'

import { lt } from '@/i18n'
import RowAction from '@/shared/components/RowAction.vue'
import RowActions from '@/shared/components/RowActions.vue'

const props = withDefaults(
  defineProps<{
    name: string
    /** `admin.*` on the admin page's lists, `mailbox.*` on the mail setup lists. */
    section: 'admin' | 'mailbox'
    editTo?: RouteLocationRaw | null
    testTo?: RouteLocationRaw | null
    usageTo?: RouteLocationRaw | null
    removable?: boolean
  }>(),
  { editTo: null, testTo: null, usageTo: null, removable: false },
)
const emit = defineEmits<{ remove: [] }>()
const { t } = useI18n()
const count = computed(
  () =>
    Number(!!props.testTo) +
    Number(!!props.usageTo) +
    Number(!!props.editTo) +
    Number(props.removable),
)
</script>

<template>
  <RowActions
    v-slot="{ menu }"
    :count="count"
    :label="`${lt(section === 'admin' ? 'admin.action' : 'mailbox.action')}: ${name}`"
    data-entry-actions
  >
    <RowAction
      v-if="usageTo"
      :menu="menu"
      :to="usageTo"
      :label="lt('admin.in_use_by')"
      :aria-label="`${lt('admin.in_use_by')}: ${name}`"
      data-action="usage"
    />
    <RowAction
      v-if="testTo"
      :menu="menu"
      :to="testTo"
      :label="t('routing.common.test')"
      :aria-label="`${t('routing.common.test')}: ${name}`"
      data-action="test"
    />
    <RowAction
      v-if="editTo"
      :menu="menu"
      :to="editTo"
      :label="lt(section === 'admin' ? 'admin.edit' : 'mailbox.edit')"
      :aria-label="`${lt(section === 'admin' ? 'admin.edit' : 'mailbox.edit')}: ${name}`"
      data-action="edit"
    />
    <RowAction
      v-if="removable"
      :menu="menu"
      destructive
      :label="lt(section === 'admin' ? 'admin.remove' : 'mailbox.remove')"
      :aria-label="`${lt(section === 'admin' ? 'admin.remove' : 'mailbox.remove')}: ${name}`"
      data-action="remove"
      @select="emit('remove')"
    />
  </RowActions>
</template>
