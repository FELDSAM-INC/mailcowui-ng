<script setup lang="ts">
// What deleting several DKIM keys does (research R9, FR-038, FR-040): every key with its kind and
// selector, the names whose mail stops being signed marked, the entries without a key that are
// skipped, and what happens to the DNS records.
import { useI18n } from 'vue-i18n'

import type { DkimKey } from '@/api'
import { text } from '@/i18n'

defineProps<{ targets: readonly DkimKey[]; skipped: readonly DkimKey[]; publication: boolean }>()
const { t } = useI18n()
</script>

<template>
  <div data-bulk-delete-impact class="flex flex-col gap-3">
    <!-- eslint-disable-next-line vuejs-accessibility/no-noninteractive-tabindex -- a scrollable list must be reachable by keyboard -->
    <ul tabindex="0" class="flex max-h-64 flex-col gap-1 overflow-y-auto">
      <li
        v-for="entry in targets"
        :key="entry.name"
        data-delete-target
        class="flex flex-col rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800"
      >
        <span class="font-medium break-all text-gray-900 dark:text-white">{{
          entry.displayName
        }}</span>
        <span class="text-sm text-gray-700 dark:text-gray-300">
          {{ text(`dns.dkim.kinds.${entry.kind}`) }}
          <template v-if="entry.key?.selector">
            ·
            <span class="font-mono text-gray-700 dark:text-gray-300">{{
              entry.key.selector
            }}</span></template
          >
        </span>
        <span
          v-if="entry.kind !== 'none'"
          data-stops-signing
          class="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {{ t('dns.dkim.delete.stopsSigning') }}
        </span>
      </li>
    </ul>
    <p class="text-gray-700 dark:text-gray-300">{{ t('dns.dkim.delete.privateKey') }}</p>
    <p class="text-gray-700 dark:text-gray-300">
      {{ publication ? t('dns.dkim.delete.recordRemoved') : t('dns.dkim.delete.recordStays') }}
    </p>
    <p
      v-if="skipped.length > 0"
      data-delete-skipped
      class="break-words text-gray-700 dark:text-gray-300"
    >
      {{
        t('dns.dkim.delete.skipped', {
          names: skipped.map((entry) => entry.displayName).join(', '),
        })
      }}
    </p>
  </div>
</template>
