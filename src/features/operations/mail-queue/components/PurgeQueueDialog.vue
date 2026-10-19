<script setup lang="ts">
// "Delete all" (FR-058, plan decision 7): legacy's `queue.delete` confirmed with
// #ConfirmDeleteModal's title, `queue.ays`, the number of queued messages read when the dialog
// opens (the API's total, also beyond the listed ones, held messages included), the typed count
// and the acknowledgement. Delete stays disabled until both are given. A Reka AlertDialog: it is
// labelled, keeps the focus inside, closes with Escape, and returns the focus to the opener.
import { useQuery } from '@tanstack/vue-query'
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { matchesTyped } from '@/shared/composables/useConfirm'
import { buttonVariants } from '@/shared/ui/button'

import { mailQueueCountsOptions } from '../api'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ confirm: [count: number] }>()
const { t } = useI18n()
const fmt = useFormat()
const typedId = useId()
const acknowledgeId = useId()
const typed = ref('')
const acknowledged = ref(false)

const counts = useQuery(computed(() => ({ ...mailQueueCountsOptions(), enabled: open.value })))
const total = computed(() => counts.data.value?.total ?? null)

watch(open, (value) => {
  if (!value) return
  typed.value = ''
  acknowledged.value = false
  void counts.refetch()
})

const ready = computed(
  () =>
    total.value !== null &&
    acknowledged.value &&
    matchesTyped(typed.value, { accepted: [String(total.value)], labelKey: '' }),
)

function onConfirm() {
  if (!ready.value || total.value === null) return
  open.value = false
  emit('confirm', total.value)
}
</script>

<template>
  <AlertDialogRoot v-model:open="open">
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-100 bg-black/50 dark:bg-black/70" />
      <AlertDialogContent
        data-purge-dialog
        class="fixed start-1/2 top-1/2 z-101 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700 shadow-theme-lg outline-none sm:max-w-lg rtl:translate-x-1/2 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
      >
        <AlertDialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ lt('footer.confirm_delete') }}
        </AlertDialogTitle>
        <AlertDialogDescription as="div" class="flex flex-col gap-2">
          <LegacyText k="queue.ays" as="p" />
          <p
            v-if="total !== null"
            data-purge-count
            class="font-medium text-gray-900 dark:text-white"
          >
            {{ t('operations.queue.purgeCount', { count: fmt.number(total) }) }}
          </p>
        </AlertDialogDescription>
        <p v-if="counts.isPending.value" role="status">{{ lt('datatables.loadingRecords') }}</p>
        <ProblemMessage
          v-else-if="total === null"
          :problem="problemOf(counts.error.value)"
          retry
          @retry="counts.refetch()"
        />
        <template v-else>
          <div class="flex flex-col gap-1.5">
            <label :for="typedId" class="font-medium text-gray-800 dark:text-gray-200">
              {{ t('bulk.confirm.typeCount', { count: total }) }}
            </label>
            <input
              :id="typedId"
              v-model="typed"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
              class="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              @keydown.enter.prevent="onConfirm"
            />
          </div>
          <label :for="acknowledgeId" class="flex min-h-11 cursor-pointer items-start gap-3">
            <input
              :id="acknowledgeId"
              v-model="acknowledged"
              type="checkbox"
              class="mt-0.5 size-5 shrink-0 accent-brand-500"
            />
            <span>{{ t('operations.queue.purgeAcknowledge') }}</span>
          </label>
        </template>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <AlertDialogCancel :class="buttonVariants({ variant: 'outline' })">
            {{ lt('footer.cancel') }}
          </AlertDialogCancel>
          <button
            type="button"
            :class="buttonVariants({ variant: 'destructive' })"
            :disabled="!ready"
            @click="onConfirm"
          >
            {{ lt('footer.delete_now') }}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
