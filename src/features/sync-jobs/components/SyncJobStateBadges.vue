<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

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
  <Badge v-else data-status :color="status.running ? 'success' : 'warning'">
    <SyncIcon v-if="status.running" class="size-3.5" />
    {{ resolveText(status.text, t) }}
  </Badge>
</template>
