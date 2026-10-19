<script setup lang="ts">
// The message's content (UI 006 FR-020, legacy form map screen 2): legacy's two parts in order,
// "Content (text/plain)" and "Content (converted html)", each "-" when missing; the parser's
// fallback note ("Parser failed, assuming HTML", hard-coded in legacy) above the converted text;
// and for a message over the content limit, legacy's "Message size exceeds …" with the limit.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { QuarantineItemDetails } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'

import TextPart from './TextPart.vue'

const props = defineProps<{
  item: Pick<QuarantineItemDetails, 'contentStatus' | 'content'>
  /** The content size limit in bytes (capabilities). */
  limit: number | null
}>()
const { t } = useI18n()
const fmt = useFormat()
const content = computed(() => props.item.content)
</script>

<template>
  <div data-content :data-content-status="item.contentStatus" class="flex flex-col gap-4">
    <p
      v-if="item.contentStatus === 'tooLarge'"
      data-too-large
      class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      {{
        t('problem.quarantine-message-too-large', {
          limit: limit === null ? '' : fmt.bytes(limit),
        })
      }}
    </p>
    <TextPart
      part="plain"
      :heading="lt('quarantine.text_plain_content')"
      :text="content?.textPlain ?? null"
    />
    <TextPart
      part="html"
      :heading="lt('quarantine.text_from_html_content')"
      :text="content?.textFromHtml ?? null"
    >
      <p
        v-if="content?.parserFallback"
        data-parser-fallback
        class="text-sm text-gray-700 dark:text-gray-300"
      >
        {{ t('quarantineUi.item.parserFallback') }}
      </p>
    </TextPart>
  </div>
</template>
