<script setup lang="ts">
// The classic "Active" and "Status" values (FR-006): the active flag as legacy's check or cross
// glyph (`mailbox.yes`, `mailbox.no`) and the status as a badge with text, Running or Waiting. An
// inactive job that is still running shows both facts. `show` picks one of them for a table cell.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Role } from '@/api'
import { resolveText } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'
import { SyncIcon } from '@/shared/icons'

import { statusView } from '../presentation'

const props = withDefaults(
  defineProps<{
    active: boolean
    running: boolean
    role: Role
    show?: 'active' | 'status'
  }>(),
  { show: 'status' },
)
const { t } = useI18n()
const status = computed(() => statusView(props.running, props.role))
</script>

<template>
  <span v-if="show === 'active'" data-active class="text-base">
    <LegacyText :k="active ? 'mailbox.yes' : 'mailbox.no'" />
  </span>
  <span
    v-else
    data-status
    class="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium"
    :class="
      status.running
        ? 'bg-green-50 text-green-800 dark:bg-green-500/15 dark:text-green-300'
        : 'bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200'
    "
  >
    <SyncIcon v-if="status.running" class="size-3.5" />
    {{ resolveText(status.text, t) }}
  </span>
</template>
