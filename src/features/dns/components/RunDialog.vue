<script setup lang="ts">
// The progress and results of a run over several names (US2/US5, research R8, FR-041, FR-042,
// FR-080, FR-085): a full-screen sheet below md, no Escape while running, "Stop" (the request in
// flight finishes, the rest is not processed), then the per-name results with "Retry" and "Close".
import { useI18n } from 'vue-i18n'

import type { ApiProblem } from '@/api'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { buttonVariants } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog'

import type { RunRow } from '../dkim/generate-run'
import RunResultList from './RunResultList.vue'

withDefaults(
  defineProps<{
    title: string
    rows: readonly RunRow[]
    total: number
    current: number
    running: boolean
    mode: 'generate' | 'copy'
    source?: string
    publication?: boolean
    stopProblem?: ApiProblem | null
  }>(),
  { source: '', publication: false, stopProblem: null },
)
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ stop: []; retry: [names: string[]] }>()
const { t } = useI18n()
const wide = useMediaQuery('(min-width: 768px)')
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :full-screen="!wide"
      :show-close-button="false"
      class="max-h-dvh overflow-y-auto"
      @escape-key-down="(event: Event) => running && event.preventDefault()"
      @pointer-down-outside.prevent
      @interact-outside.prevent
    >
      <div data-run-dialog class="flex min-h-full flex-col gap-4">
        <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ title }}
        </DialogTitle>
        <RunResultList
          :rows="rows"
          :total="total"
          :current="current"
          :running="running"
          :mode="mode"
          :source="source"
          :publication="publication"
          @retry="emit('retry', $event)"
        >
          <template #publish-action="{ row }"><slot name="publish-action" :row="row" /></template>
        </RunResultList>
        <ProblemMessage v-if="!running && stopProblem" :problem="stopProblem" />
        <div
          data-dialog-actions
          class="sticky bottom-0 -mx-6 mt-auto flex flex-col-reverse gap-2 border-t border-gray-200 bg-white px-6 py-3 sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:p-0 dark:border-gray-800 dark:bg-[#1E2635]"
        >
          <button
            v-if="running"
            type="button"
            data-run-stop
            :class="buttonVariants({ variant: 'outline' })"
            @click="emit('stop')"
          >
            {{ t('dns.dkim.run.stop') }}
          </button>
          <button
            v-else
            type="button"
            :class="buttonVariants({ variant: 'default' })"
            @click="open = false"
          >
            {{ t('common.close') }}
          </button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
