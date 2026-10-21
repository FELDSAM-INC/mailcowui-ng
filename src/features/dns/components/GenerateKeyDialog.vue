<script setup lang="ts">
// Generating DKIM keys (US2, FR-025 to FR-027; legacy's add form in `admin/tab-config-dkim.twig`):
// the names read-only under "Domain/s" (the first 10 and a count), the entries of a selection that
// already have a key as skipped, the selector pre-filled with the server's default and checked
// before sending (legacy's `danger.dkim_domain_or_sel_invalid`), and the server's key lengths with
// its default. One submission at a time; no Escape while sending; full screen below md with the
// actions in a footer that stays visible (FR-080). `ReplaceKeyDialog` reuses it with its own title,
// hint and submit label.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ApiProblem, DnsCapabilities } from '@/api'
import { lt } from '@/i18n'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { buttonVariants } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'

import { namePreview, type RunName } from '../dkim/generate-run'

const props = withDefaults(
  defineProps<{
    names: readonly RunName[]
    skipped?: readonly RunName[]
    caps: DnsCapabilities
    pending?: boolean
    problem?: ApiProblem | null
    title?: string
    submitLabel?: string
    /** A hint above the selector (the replacement's recommendation). */
    hint?: string | null
    /** The selector to start with instead of the server's default. */
    initialSelector?: string
  }>(),
  {
    skipped: () => [],
    pending: false,
    problem: null,
    title: undefined,
    submitLabel: undefined,
    hint: null,
    initialSelector: undefined,
  },
)
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ submit: [values: { selector: string; keySize: number }] }>()

const { t } = useI18n()
const wide = useMediaQuery('(min-width: 768px)')
const selector = ref('')
const keySize = ref(2048)
const selectorErrors = ref<string[]>([])
let submitted = false

const SELECTOR_PATTERN = /^[A-Za-z0-9._-]+$/
const firstName = computed(() => props.names[0]?.name ?? '')
const preview = computed(() => namePreview(props.names))

const form = useProblemForm({
  fieldId: (path) =>
    path === 'selector'
      ? 'dkim-generate-selector'
      : path === 'keySize'
        ? 'dkim-generate-size'
        : null,
  formKey: 'dns.dkim.form',
  problemParams: () => ({ name: firstName.value }),
})

watch(
  () => [open.value, props.names] as const,
  ([isOpen]) => {
    if (!isOpen) return
    selector.value = props.initialSelector ?? props.caps.dkim.defaultSelector
    keySize.value = props.caps.dkim.allowedKeySizes.includes(props.caps.dkim.defaultKeySize)
      ? props.caps.dkim.defaultKeySize
      : (props.caps.dkim.allowedKeySizes[0] ?? 2048)
    selectorErrors.value = []
    form.clear()
    submitted = false
  },
  { immediate: true },
)

watch(
  () => props.problem,
  (problem) => {
    void form.setProblem(problem)
    if (problem) submitted = false
  },
)
watch(
  () => props.pending,
  (pending) => {
    if (!pending) submitted = false
  },
)

const errors = computed(() => [...selectorErrors.value, ...form.errorsFor('selector')])

function onSubmit(event: Event) {
  event.preventDefault()
  if (props.pending || submitted) return
  const value = selector.value.trim()
  const invalid =
    value === '' ||
    value.length > props.caps.dkim.selectorMaxLength ||
    !SELECTOR_PATTERN.test(value)
  if (invalid) {
    selectorErrors.value = [lt('danger.dkim_domain_or_sel_invalid', firstName.value)]
    void form.setClientMessages({ selector: selectorErrors.value })
    return
  }
  selectorErrors.value = []
  form.clear()
  submitted = true
  emit('submit', { selector: value, keySize: keySize.value })
}

function blockWhileBusy(event: Event) {
  if (props.pending) event.preventDefault()
}

const SELECT =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :full-screen="!wide"
      :show-close-button="false"
      class="max-h-dvh overflow-y-auto"
      @escape-key-down="blockWhileBusy"
      @pointer-down-outside.prevent
      @interact-outside.prevent
      @open-auto-focus.prevent="
        ($event.target as HTMLElement | null)?.querySelector<HTMLElement>('h2')?.focus()
      "
    >
      <form class="flex min-h-full flex-col gap-4" novalidate @submit="onSubmit">
        <DialogTitle
          tabindex="-1"
          class="text-lg font-semibold text-gray-900 focus:outline-none dark:text-white"
        >
          {{ title ?? lt('admin.dkim_add_key') }}
        </DialogTitle>
        <DialogDescription as="div" class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-gray-800 dark:text-gray-200">{{
            lt('admin.domain_s')
          }}</span>
          <ul data-generate-names class="flex flex-col gap-0.5 text-gray-900 dark:text-white">
            <li v-for="item in preview.shown" :key="item" class="break-all">{{ item }}</li>
          </ul>
          <span v-if="preview.more > 0" class="text-gray-700 dark:text-gray-300">
            {{ t('dns.dkim.generate.namesMore', { count: preview.more }) }}
          </span>
        </DialogDescription>
        <p
          v-if="skipped.length > 0"
          data-generate-skipped
          class="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm break-words text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
        >
          {{
            t('dns.dkim.generate.skipped', {
              names: skipped.map((item) => item.label).join(', '),
            })
          }}
        </p>
        <ErrorSummary :id="form.summaryId" :items="form.summary.value" />
        <ProblemMessage :problem="form.formProblem.value" :params="{ name: firstName }" />
        <p
          v-if="hint"
          data-generate-hint
          class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          {{ hint }}
        </p>
        <FormField
          id="dkim-generate-selector"
          v-slot="field"
          :label="lt('admin.dkim_domains_selector')"
          :errors="errors"
        >
          <input
            v-bind="field"
            v-model="selector"
            type="text"
            :maxlength="caps.dkim.selectorMaxLength + 1"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            class="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 font-mono text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </FormField>
        <FormField
          id="dkim-generate-size"
          v-slot="field"
          :label="lt('admin.dkim_key_length')"
          :errors="form.errorsFor('keySize')"
        >
          <select v-bind="field" v-model.number="keySize" :class="SELECT">
            <option v-for="size in caps.dkim.allowedKeySizes" :key="size" :value="size">
              {{ size }}
            </option>
          </select>
        </FormField>
        <div
          data-dialog-actions
          class="sticky bottom-0 -mx-6 mt-auto flex flex-col-reverse gap-2 border-t border-gray-200 bg-white px-6 py-3 sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:p-0 dark:border-gray-800 dark:bg-surface"
        >
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            :disabled="pending"
            @click="open = false"
          >
            {{ lt('footer.cancel') }}
          </button>
          <button type="submit" :class="buttonVariants({ variant: 'default' })" :disabled="pending">
            {{ submitLabel ?? lt('admin.add') }}
          </button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
