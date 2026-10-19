<script setup lang="ts">
// "Remove hash" (FR-058, legacy form map screen 7, D23): the reset of a rate-limit bucket by its
// identifier, for administrators. The form step has legacy's title and button `admin.reset_limit`,
// its explanation `admin.hash_remove_info` whole with its markup, and the identifier ("Hash", as
// the rate-limited log's column), checked against the contract's form before anything is sent.
// The confirmation step is legacy's `#ConfirmDeleteModal`: `footer.confirm_delete`,
// `footer.delete_these_items` with the identifier, `footer.delete_now` and `footer.cancel`. A
// reset says `success.hash_deleted`, nothing to reset `warning.hash_not_found` (both through
// `done`, the dialog closes); a shared store that is down changed nothing, and the dialog stays
// with a retry. UI 011 opens it from a log entry with `bucketId` filled in.
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import PlainText from '@/shared/components/PlainText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { buttonVariants } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { RATE_LIMIT_BUCKET_ID_MAX_LENGTH } from '@/shared/validation/limits'

import { checkBucketId } from '../bucket-id'
import { useResetRateLimitBucket, type ResetOutcome } from '../composables/useResetRateLimitBucket'

const props = withDefaults(defineProps<{ bucketId?: string }>(), { bucketId: '' })
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ done: [outcome: ResetOutcome] }>()

const { t } = useI18n()
const wide = useMediaQuery('(min-width: 768px)')
const { pending, problem, reset } = useResetRateLimitBucket()

const FIELD_ID = 'reset-bucket-hash'
const step = ref<'form' | 'confirm'>('form')
const hash = ref('')
const confirmed = ref('')
const errors = ref<string[]>([])
const content = ref<HTMLElement | null>(null)

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    step.value = 'form'
    hash.value = props.bucketId
    confirmed.value = ''
    errors.value = []
    problem.value = null
  },
  { immediate: true },
)

function focusTitle() {
  void nextTick(() => content.value?.querySelector<HTMLElement>('h2')?.focus())
}

function onSubmit(event: Event) {
  event.preventDefault()
  const check = checkBucketId(hash.value)
  if (!check.ok) {
    errors.value = [
      check.reason === 'required'
        ? t('validation.required')
        : check.reason === 'tooLong'
          ? t('validation.tooLong', { max: RATE_LIMIT_BUCKET_ID_MAX_LENGTH })
          : t('validation.invalidFormat'),
    ]
    announce(errors.value.join(' '), { assertive: true })
    void nextTick(() => document.getElementById(FIELD_ID)?.focus())
    return
  }
  errors.value = []
  confirmed.value = check.bucketId
  step.value = 'confirm'
  focusTitle()
}

async function onConfirm() {
  const outcome = await reset(confirmed.value)
  if (!outcome) return
  open.value = false
  emit('done', outcome)
}

const retryable = computed(
  () => !!problem.value && (problem.value.status === 503 || problem.value.kind === 'network'),
)

function blockWhileBusy(event: Event) {
  if (pending.value) event.preventDefault()
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :full-screen="!wide"
      :show-close-button="false"
      class="max-h-dvh overflow-y-auto"
      data-reset-bucket-dialog
      @escape-key-down="blockWhileBusy"
      @pointer-down-outside.prevent
      @interact-outside.prevent
      @open-auto-focus.prevent="
        ($event.target as HTMLElement | null)?.querySelector<HTMLElement>('h2')?.focus()
      "
    >
      <div ref="content" class="flex min-h-full flex-col">
        <form
          v-if="step === 'form'"
          class="flex min-h-full flex-col gap-4"
          novalidate
          @submit="onSubmit"
        >
          <DialogTitle
            tabindex="-1"
            class="text-lg font-semibold text-gray-900 focus:outline-none dark:text-white"
          >
            {{ lt('admin.reset_limit') }}
          </DialogTitle>
          <DialogDescription as="div" class="text-sm text-gray-700 dark:text-gray-300">
            <LegacyText k="admin.hash_remove_info" as="p" />
          </DialogDescription>
          <FormField
            :id="FIELD_ID"
            v-slot="field"
            :label="t('rateLimits.bucket.hash')"
            :errors="errors"
          >
            <input
              v-bind="field"
              v-model="hash"
              type="text"
              :maxlength="RATE_LIMIT_BUCKET_ID_MAX_LENGTH + 1"
              autocomplete="off"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
              class="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 font-mono text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </FormField>
          <div
            data-dialog-actions
            class="sticky bottom-0 -mx-6 mt-auto flex flex-col-reverse gap-2 border-t border-gray-200 bg-white px-6 py-3 sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:p-0 dark:border-gray-800 dark:bg-[#1E2635]"
          >
            <button
              type="button"
              :class="buttonVariants({ variant: 'outline' })"
              @click="open = false"
            >
              {{ lt('footer.cancel') }}
            </button>
            <button type="submit" :class="buttonVariants({ variant: 'destructive' })">
              {{ lt('admin.reset_limit') }}
            </button>
          </div>
        </form>
        <div v-else class="flex min-h-full flex-col gap-4" data-reset-bucket-confirm>
          <DialogTitle
            tabindex="-1"
            class="text-lg font-semibold text-gray-900 focus:outline-none dark:text-white"
          >
            {{ lt('footer.confirm_delete') }}
          </DialogTitle>
          <DialogDescription as="div" class="flex flex-col gap-2 text-sm">
            <p class="text-gray-700 dark:text-gray-300">{{ lt('footer.delete_these_items') }}</p>
            <ul class="list-disc ps-5 font-mono text-gray-900 dark:text-white">
              <li class="break-all"><PlainText :value="confirmed" /></li>
            </ul>
          </DialogDescription>
          <ProblemMessage :problem="problem" :retry="retryable" @retry="onConfirm" />
          <div
            data-dialog-actions
            class="sticky bottom-0 -mx-6 mt-auto flex flex-col-reverse gap-2 border-t border-gray-200 bg-white px-6 py-3 sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:p-0 dark:border-gray-800 dark:bg-[#1E2635]"
          >
            <button
              type="button"
              :class="buttonVariants({ variant: 'outline' })"
              :disabled="pending"
              @click="open = false"
            >
              {{ lt('footer.cancel') }}
            </button>
            <button
              type="button"
              :class="buttonVariants({ variant: 'destructive' })"
              :disabled="pending"
              @click="onConfirm"
            >
              {{ lt('footer.delete_now') }}
            </button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
