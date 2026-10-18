<script setup lang="ts">
// The last run: the time relative and in full (FR-051), or "Waiting" without one, as the classic
// table reads (plan deviation 1 is open).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Role, SyncJobRunStatus } from '@/api'
import { resolveText } from '@/i18n'
import RelativeTime from '@/shared/components/RelativeTime.vue'

import { lastRunView } from '../presentation'

const props = defineProps<{ run: SyncJobRunStatus; role: Role }>()
const { t } = useI18n()
const view = computed(() => lastRunView(props.run, props.role))
</script>

<template>
  <span data-last-run>
    <RelativeTime v-if="view.kind === 'time'" :value="view.at" />
    <template v-else>{{ resolveText(view.text, t) }}</template>
  </span>
</template>
