<script setup lang="ts">
// The quarantine's status above the list, for every role (UI 006 FR-008, legacy form map screen 1):
// when inactive, legacy's `quarantine.disabled_by_config`; otherwise legacy's
// `quarantine.settings_info` with the items kept per mailbox and the maximum size in MiB, as legacy
// fills it from the settings. Legacy's explanation `quarantine.qinfo` follows whole, with its
// markup, behind a disclosure labelled `quarantine.info` (D18).
import { computed } from 'vue'

import type { QuarantineSettings } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import LegacyText from '@/shared/components/LegacyText.vue'
import { InfoIcon } from '@/shared/icons'

const MIB = 1_048_576

const props = defineProps<{
  settings: Pick<QuarantineSettings, 'active' | 'retentionPerMailbox' | 'maxMessageSize'> | null
}>()
const fmt = useFormat()
const args = computed(() =>
  props.settings
    ? [
        fmt.number(props.settings.retentionPerMailbox),
        fmt.number(props.settings.maxMessageSize / MIB),
      ]
    : [],
)
</script>

<template>
  <div data-status-notice class="flex flex-col gap-3 text-sm">
    <p
      v-if="settings && !settings.active"
      data-quarantine-inactive
      class="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100"
    >
      <InfoIcon class="mt-0.5 size-4 shrink-0" />
      <span class="min-w-0">{{ lt('quarantine.disabled_by_config') }}</span>
    </p>
    <LegacyText
      v-else-if="settings"
      data-quarantine-active
      k="quarantine.settings_info"
      :args="args"
      as="p"
      class="text-gray-700 dark:text-gray-300"
    />
    <details data-qinfo class="group rounded-xl border border-gray-200 dark:border-gray-800">
      <summary
        class="flex min-h-11 cursor-pointer items-center gap-2 px-3 font-medium text-gray-800 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-200"
      >
        <InfoIcon class="size-4 shrink-0" />
        {{ lt('quarantine.info') }}
      </summary>
      <LegacyText
        k="quarantine.qinfo"
        as="p"
        class="px-3 pb-3 text-gray-700 dark:text-gray-300"
      />
    </details>
  </div>
</template>
