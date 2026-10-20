<script setup lang="ts">
// The one-time secret dialog (conventions "Secrets", data-model §7, FR-066, FR-080): a generated
// secret is shown once, with a copy button and a warning. A refused clipboard selects the secret
// for manual copying. Closing, Escape or leaving the page without having copied asks for
// confirmation first (`requestClose`, also used by the page's route-leave guard). The secret lives
// only in the caller's state and this dialog's props: never in storage, the router or a query
// cache, and the dialog pushes no history entry. Created by UI 001 (API keys); UI 005, 010 and
// 012 reuse it. UI 010 (research R12): `multiline` shows the secret in a read-only text area (a
// private key), and `download` offers it as a file, which counts as saved, as a copy does.
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, ref, useId, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import GroupedSecret from './GroupedSecret.vue'

import { CopyIcon, WarningIcon } from '../icons'
import { announce } from '../composables/useAnnouncer'
import { confirm } from '../composables/useConfirm'
import { copyText } from '../platform/clipboard'
import { downloadText } from '../platform/download'
import { buttonVariants } from '../ui/button'

const props = defineProps<{
  /** The secret; the dialog is open while it is set. */
  secret: string | null
  title: string
  description?: string
  username?: string
  grouped?: boolean
  /** Shows the secret in a multi-line, read-only text area. */
  multiline?: boolean
  /** Offers the secret as a file; a download counts as saved. */
  download?: { fileName: string; mediaType: string }
}>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const fieldId = useId()
const warningId = useId()
const input = useTemplateRef<HTMLInputElement | HTMLTextAreaElement>('input')
const copied = ref(false)
const outcome = ref<'copied' | 'refused' | null>(null)
let closing = false

const open = computed(() => props.secret !== null)

watch(
  () => props.secret,
  () => {
    copied.value = false
    outcome.value = null
    closing = false
  },
)

async function copy() {
  if (!props.secret) return
  const result = await copyText(props.secret)
  outcome.value = result
  if (result === 'copied') {
    copied.value = true
    announce(t('secrets.copied'))
  } else {
    input.value?.focus()
    input.value?.select()
    announce(t('secrets.copyRefused'), { assertive: true })
  }
}

function save() {
  if (!props.secret || !props.download) return
  downloadText(props.secret, props.download.fileName, props.download.mediaType)
  copied.value = true
}

/** Closes the dialog, asking first when the secret was not copied. Resolves true once closed. */
async function requestClose(): Promise<boolean> {
  if (!open.value) return true
  if (closing) return false
  closing = true
  try {
    if (!copied.value) {
      const confirmed = await confirm({
        title: t('secrets.confirmClose.title'),
        description: t('secrets.confirmClose.body'),
        confirmLabel: t('secrets.confirmClose.confirm'),
        cancelLabel: t('secrets.confirmClose.cancel'),
      })
      if (!confirmed) return false
    }
    copied.value = false
    outcome.value = null
    emit('close')
    return true
  } finally {
    closing = false
  }
}

function onEscape(event: KeyboardEvent) {
  event.preventDefault()
  void requestClose()
}

defineExpose({ requestClose })
</script>

<template>
  <DialogRoot :open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-100 bg-black/50 dark:bg-black/70" />
      <DialogContent
        class="fixed start-1/2 top-1/2 z-101 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 text-gray-700 shadow-theme-lg outline-none sm:max-w-lg dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
        :aria-describedby="description ? undefined : warningId"
        @escape-key-down="onEscape"
        @pointer-down-outside.prevent
        @interact-outside.prevent
        @focus-outside.prevent
        @close-auto-focus.prevent
      >
        <DialogTitle class="text-lg font-semibold wrap-anywhere text-gray-900 dark:text-white">
          {{ title }}
        </DialogTitle>
        <DialogDescription v-if="description">{{ description }}</DialogDescription>
        <div
          :id="warningId"
          class="flex gap-3 rounded-xl border border-warning-200 bg-warning-50 p-4 text-warning-900 dark:border-warning-900 dark:bg-warning-950 dark:text-warning-100"
        >
          <WarningIcon class="mt-0.5 size-5 shrink-0" />
          <p>{{ t('secrets.warning') }}</p>
        </div>
        <p v-if="username" class="text-sm wrap-anywhere">
          <span class="font-medium">{{ lt('user.username') }}</span
          >: {{ username }}
        </p>
        <div class="flex flex-col gap-1.5">
          <label :for="fieldId" class="text-sm font-medium text-gray-800 dark:text-gray-200">
            {{ t('secrets.label') }}
          </label>
          <GroupedSecret
            v-if="grouped && secret"
            :value="secret"
            :copy-label="t('secrets.copy')"
            :show-copy="false"
            aria-hidden="true"
          />
          <div class="flex flex-col gap-2" :class="multiline ? '' : 'sm:flex-row'">
            <textarea
              v-if="multiline"
              :id="fieldId"
              ref="input"
              :value="secret ?? ''"
              readonly
              rows="8"
              autocomplete="off"
              spellcheck="false"
              :aria-describedby="warningId"
              class="form-control min-w-0 flex-1 font-mono text-xs break-all"
            />
            <input
              v-else
              :id="fieldId"
              ref="input"
              :value="secret ?? ''"
              readonly
              autocomplete="off"
              spellcheck="false"
              :aria-describedby="warningId"
              class="form-control min-w-0 flex-1 font-mono text-sm"
              :class="grouped && outcome !== 'refused' ? 'sr-only' : ''"
              :tabindex="grouped && outcome !== 'refused' ? -1 : undefined"
            />
            <div class="flex flex-wrap gap-2">
              <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="copy">
                <CopyIcon class="size-5" />
                {{ t('secrets.copy') }}
              </button>
              <button
                v-if="download"
                type="button"
                :class="buttonVariants({ variant: 'outline' })"
                @click="save"
              >
                {{ t('secrets.download') }}
              </button>
            </div>
          </div>
        </div>
        <p v-if="outcome === 'copied'" role="status" class="text-sm font-medium">
          {{ t('secrets.copied') }}
        </p>
        <p
          v-else-if="outcome === 'refused'"
          role="alert"
          class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {{ t('secrets.copyRefused') }}
        </p>
        <div class="flex justify-end">
          <button type="button" :class="buttonVariants({})" @click="requestClose">
            {{ t('secrets.close') }}
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
