<script setup lang="ts">
// A queued message's content (FR-061, research R15), replacing legacy's `#showQueuedMsg` dialog
// (title "ID <queue ID>", a 40-row text area): full screen below md and a large dialog from md up,
// the notice that each view is recorded in the audit log, and the content verbatim as plain text in
// a fixed-width font (control and bidi characters as visible markers). Only the first 256 Ki
// characters are rendered at first; "Show the rest" renders everything, and Copy always copies the
// complete, unmodified content. The content is fetched when the viewer opens and removed from the
// cache when it closes. A message that left the queue says so and leaves the cached list.
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { isApiProblem, problemOf, queryKeys } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import PlainText from '@/shared/components/PlainText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { CloseIcon, CopyIcon } from '@/shared/icons'
import { copyText } from '@/shared/platform/clipboard'
import { buttonVariants } from '@/shared/ui/button'

import { forgetQueuedMessage, mailQueueContentOptions } from '../api'
import { firstView } from '../content'

const props = defineProps<{ queueId: string }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const fmt = useFormat()
const client = useQueryClient()
const wide = useMediaQuery('(min-width: 768px)')
const complete = ref(false)

const query = useQuery(computed(() => mailQueueContentOptions(props.queueId)))
const content = computed(() => query.data.value?.content ?? null)
const view = computed(() => (content.value === null ? null : firstView(content.value)))
const shown = computed(() =>
  content.value === null ? '' : complete.value ? content.value : (view.value?.text ?? ''),
)
// The size of what is not shown yet, in bytes as Postfix counts the message.
const restBytes = computed(() =>
  content.value === null || !view.value?.rest
    ? 0
    : new TextEncoder().encode(content.value.slice(view.value.text.length)).length,
)
const gone = computed(() => isApiProblem(query.error.value) && query.error.value.status === 404)

watch(gone, (value) => {
  if (value) forgetQueuedMessage(client, props.queueId)
})

async function copy() {
  if (content.value === null) return
  const outcome = await copyText(content.value)
  announce(outcome === 'copied' ? lt('admin.copy_to_clipboard') : t('operations.copyRefused'))
}

onBeforeUnmount(() => {
  client.removeQueries({ queryKey: queryKeys.mailQueue.content(props.queueId) })
})

const CONTENT_WIDE =
  'fixed start-1/2 top-1/2 z-101 flex h-[90vh] w-[min(72rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700 shadow-theme-lg outline-none rtl:translate-x-1/2 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'
const CONTENT_FULL =
  'fixed inset-0 z-101 flex h-dvh w-full flex-col gap-3 bg-white p-4 text-sm text-gray-700 outline-none dark:bg-gray-900 dark:text-gray-300'
</script>

<template>
  <DialogRoot :open="true" @update:open="(open) => !open && emit('close')">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-100 bg-black/50 dark:bg-black/70" />
      <DialogContent
        data-content-viewer
        :class="wide ? CONTENT_WIDE : CONTENT_FULL"
        @close-auto-focus.prevent
      >
        <div class="flex items-start gap-3">
          <DialogTitle
            class="min-w-0 flex-1 text-lg font-semibold wrap-anywhere text-gray-900 dark:text-white"
          >
            {{ t('operations.queue.viewerTitle', { id: queueId }) }}
          </DialogTitle>
          <button
            type="button"
            :class="buttonVariants({ variant: 'ghost', size: 'icon' })"
            :aria-label="t('common.close')"
            @click="emit('close')"
          >
            <CloseIcon />
          </button>
        </div>
        <DialogDescription class="text-gray-600 dark:text-gray-400">
          {{ t('operations.queue.viewAudited') }}
        </DialogDescription>
        <p v-if="gone" role="alert" class="font-medium text-gray-900 dark:text-white">
          {{ t('operations.queue.messageGone') }}
        </p>
        <div v-else-if="query.isPending.value" role="status" aria-busy="true">
          {{ lt('datatables.loadingRecords') }}
        </div>
        <ProblemMessage
          v-else-if="content === null"
          :problem="problemOf(query.error.value)"
          retry
          @retry="query.refetch()"
        />
        <template v-else>
          <div class="flex flex-wrap gap-2">
            <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="copy">
              <CopyIcon class="size-5" />
              {{ t('operations.copy') }}
            </button>
            <button
              v-if="!complete && view && view.rest > 0"
              type="button"
              data-show-rest
              :class="buttonVariants({ variant: 'outline' })"
              @click="complete = true"
            >
              {{ t('operations.queue.showRest', { size: fmt.bytes(restBytes) }) }}
            </button>
          </div>
          <!-- eslint-disable-next-line vuejs-accessibility/no-noninteractive-tabindex -- a scrollable region must take focus -->
          <div
            role="region"
            :aria-label="t('operations.queue.viewerTitle', { id: queueId })"
            tabindex="0"
            data-message-content
            class="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-5 text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
          >
            <PlainText :value="shown" multiline as="div" />
          </div>
        </template>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
