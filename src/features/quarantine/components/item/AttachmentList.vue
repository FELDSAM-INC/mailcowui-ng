<script setup lang="ts">
// The message's attachments (UI 006 FR-023, FR-036, FR-084, legacy form map screen 2), shown only
// when the API includes them (legacy's `quarantine_attachments` permission): legacy's heading
// `quarantine.atts`; per file its name as the download action and its declared type in
// parentheses, as legacy lists them, then the size (`debug.size`), the SHA-256 with a copy
// control, and legacy's "Search file hash @ VT" link, built only for a valid hash, opened in a new
// browsing context without the app's address. "-" when there are none. File names, types and
// hashes are data: PlainText.
import { useI18n } from 'vue-i18n'

import type { QuarantineAttachment } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import CopyButton from '@/shared/components/CopyButton.vue'
import PlainText from '@/shared/components/PlainText.vue'

const SHA256 = /^[0-9a-f]{64}$/

defineProps<{ attachments: readonly QuarantineAttachment[]; busy?: boolean }>()
const emit = defineEmits<{ download: [attachment: QuarantineAttachment] }>()
const { t } = useI18n()
const fmt = useFormat()

const lookup = (sha256: string) =>
  SHA256.test(sha256) ? `https://www.virustotal.com/file/${sha256}/analysis/` : null
</script>

<template>
  <section aria-labelledby="qitem-atts" class="flex flex-col gap-2">
    <h2 id="qitem-atts" class="text-lg font-semibold text-gray-900 dark:text-white">
      {{ lt('quarantine.atts') }}
    </h2>
    <ul v-if="attachments.length > 0" data-attachments class="flex flex-col gap-3">
      <li
        v-for="attachment in attachments"
        :key="attachment.position"
        :data-attachment="attachment.position"
        class="flex min-w-0 flex-col gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-800"
      >
        <p class="flex min-w-0 flex-wrap items-center gap-x-2">
          <button
            type="button"
            data-attachment-download
            class="inline-flex min-h-11 max-w-full items-center gap-2 text-start font-medium text-accent-text bg-white dark:bg-gray-900 underline underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-60"
            :disabled="busy"
            @click="emit('download', attachment)"
          >
            <span class="min-w-0"><PlainText :value="attachment.fileName" /></span>
          </button>
          <span class="text-sm text-gray-700 dark:text-gray-300"
            >(<PlainText :value="attachment.contentType" />)</span
          >
        </p>
        <dl class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-sm">
          <dt class="text-gray-600 dark:text-gray-400">{{ lt('debug.size') }}</dt>
          <dd class="text-gray-900 tabular-nums dark:text-white">
            {{ fmt.bytes(attachment.size) }}
          </dd>
          <dt class="text-gray-600 dark:text-gray-400">{{ t('quarantineUi.item.sha256') }}</dt>
          <dd class="flex min-w-0 items-center gap-2">
            <span data-sha256 class="min-w-0 flex-1 font-mono text-xs text-gray-900 dark:text-white"
              ><PlainText :value="attachment.sha256"
            /></span>
            <CopyButton
              :text="attachment.sha256"
              :label="t('quarantineUi.item.copySha256', { number: attachment.position + 1 })"
              icon-only
            />
          </dd>
        </dl>
        <a
          v-if="lookup(attachment.sha256)"
          data-hash-lookup
          :href="lookup(attachment.sha256)!"
          target="_blank"
          rel="noopener noreferrer"
          referrerpolicy="no-referrer"
          class="inline-flex min-h-11 items-center self-start text-sm text-accent-text bg-white dark:bg-gray-900 underline underline-offset-2 hover:underline"
        >
          {{ lt('quarantine.check_hash') }}
          <span class="sr-only">{{ ` ${t('common.opensInNewTab')}` }}</span>
        </a>
      </li>
    </ul>
    <p v-else class="text-gray-900 dark:text-white">-</p>
  </section>
</template>
