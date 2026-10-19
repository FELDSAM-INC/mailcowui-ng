<script setup lang="ts">
// Importing a private key (US5, FR-029 to FR-033; legacy's "Import private key" form, as a page):
// the name ("Domain:", pre-filled from `?name=`), the selector (the server's default), the key and
// "Overwrite existing DKIM key". The name is looked up once it is valid (400 ms after typing): a key
// that exists is named with its selector and length and its version tag is kept for the overwrite;
// a name that is neither a domain nor an alias domain gets an unused key. Overwriting asks first.
// The key lives only in this page's state (never a cache, the address, history or storage): it is
// cleared after success, on `pagehide` and when the user confirms leaving, and kept after a
// refusal. Success replaces the page with the entry and says `success.dkim_added`.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { isApiProblem, problemOf, type DkimKey } from '@/api'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { confirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { useStickyBarFocus } from '@/shared/composables/useStickyBarFocus'
import { buttonVariants } from '@/shared/ui/button'
import { isValidDomainName } from '@/shared/validation/domain-name'
import { DKIM_NAME_MAX_LENGTH } from '@/shared/validation/limits'
import { utf8ByteLength } from '@/shared/validation/utf8'

import { useDnsCapabilities } from '../api/capabilities'
import { fetchDkimKey } from '../api/dkim'
import { importKey, type ImportBody } from '../api/dkim-secrets'
import PrivateKeyField from '../components/PrivateKeyField.vue'
import { dkimKeyLocation } from '../names'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const client = useQueryClient()
const capabilities = useDnsCapabilities()
useStickyBarFocus()

const name = ref(typeof route.query.name === 'string' ? route.query.name : '')
const selector = ref('')
const privateKey = ref('')
const overwrite = ref(false)
const clientErrors = ref<Record<string, string[]>>({})

watch(
  () => capabilities.data.value?.dkim.defaultSelector,
  (value) => {
    if (value && !selector.value) selector.value = value
  },
  { immediate: true },
)

// The name lookup (FR-030): debounced, only for a valid name; the result is a normal query.
const existing = shallowRef<DkimKey | null>(null)
const lookup = ref<'idle' | 'found' | 'unused' | 'domain'>('idle')
let timer: ReturnType<typeof setTimeout> | undefined
let lookupSeq = 0
async function lookUp(value: string) {
  const sequence = ++lookupSeq
  if (!isValidDomainName(value)) {
    existing.value = null
    lookup.value = 'idle'
    return
  }
  try {
    const entry = await fetchDkimKey(value)
    if (sequence !== lookupSeq) return
    existing.value = entry.key ? entry : null
    lookup.value = entry.key ? 'found' : 'domain'
  } catch (error) {
    if (sequence !== lookupSeq) return
    existing.value = null
    lookup.value = isApiProblem(error) && error.status === 404 ? 'unused' : 'idle'
  }
}
watch(
  name,
  (value) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void lookUp(value.trim()), 400)
  },
  { immediate: true },
)

const request = useSecretRequest((target: string, body: ImportBody, ifMatch: string | null) =>
  importKey(client, target, body, ifMatch),
)

const form = useProblemForm({
  fieldId: (path) =>
    path === 'dkimName' || path === 'name'
      ? 'dkim-import-name'
      : path === 'selector'
        ? 'dkim-import-selector'
        : path === 'privateKey'
          ? 'dkim-import-key'
          : null,
  formKey: 'dns.dkim.form',
  problemFields: { 'dkim-key-exists': 'dkimName' },
  problemParams: () => ({ name: name.value.trim() }),
})
const keyExists = computed(() => form.problem.value?.is('dkim-key-exists') ?? false)

const errorsFor = (path: string) => [...(clientErrors.value[path] ?? []), ...form.errorsFor(path)]

function validate(): boolean {
  const caps = capabilities.data.value
  const errors: Record<string, string[]> = {}
  const target = name.value.trim()
  if (!target) errors.name = [t('validation.required')]
  else if (target.length > DKIM_NAME_MAX_LENGTH || !isValidDomainName(target)) {
    errors.name = [t('validation.format.domainName')]
  }
  const value = selector.value.trim()
  if (
    !value ||
    value.length > (caps?.dkim.selectorMaxLength ?? 255) ||
    !/^[A-Za-z0-9._-]+$/.test(value)
  ) {
    errors.selector = [lt('danger.dkim_domain_or_sel_invalid', target)]
  }
  if (!privateKey.value.trim()) errors.privateKey = [t('validation.required')]
  else if (caps && utf8ByteLength(privateKey.value) > caps.dkim.privateKeyMaxBytes) {
    errors.privateKey = [t('dns.dkim.import.tooLarge')]
  }
  clientErrors.value = {}
  if (Object.keys(errors).length > 0) {
    clientErrors.value = errors
    void form.setClientMessages({})
    void form.setClientMessages(
      Object.fromEntries(
        Object.entries(errors).map(([path, messages]) => [
          path === 'name' ? 'dkimName' : path,
          messages,
        ]),
      ),
    )
    clientErrors.value = {}
    return false
  }
  return true
}

const pending = computed(() => request.pending.value)

async function submit(event: Event) {
  event.preventDefault()
  if (pending.value || !validate()) return
  const target = name.value.trim()
  let current = overwrite.value ? existing.value : null
  for (;;) {
    if (overwrite.value && current?.key) {
      const length = current.key.keyLength
      const go = await confirm({
        title: lt('admin.dkim_overwrite_key'),
        description: t('dns.dkim.import.confirmOverwrite', {
          selector: current.key.selector ?? '–',
          length: length ? formatNumber(length, locale.value as AppLocale) : '–',
        }),
        confirmLabel: lt('admin.import'),
        destructive: true,
      })
      if (!go) return
    }
    form.clear()
    const result = await request.run(
      target,
      { privateKey: privateKey.value, selector: selector.value.trim(), overwrite: overwrite.value },
      overwrite.value ? (current?.etag ?? null) : null,
    )
    if (result) {
      privateKey.value = ''
      guard.disarm()
      announce(lt('success.dkim_added', result.name))
      await router.replace(dkimKeyLocation(result.name))
      return
    }
    const problem = request.problem.value
    if (problem?.status === 412) {
      current = await fetchDkimKey(target).catch(() => null)
      existing.value = current?.key ? current : null
      continue
    }
    await form.setProblem(problem)
    return
  }
}

function switchOnOverwrite() {
  overwrite.value = true
  void lookUp(name.value.trim())
  document.getElementById('dkim-import-overwrite')?.focus()
}

// The key never outlives the page: cleared on pagehide (back-forward cache) and after leaving.
function clearKey() {
  privateKey.value = ''
}
onMounted(() => window.addEventListener('pagehide', clearKey))
onBeforeUnmount(() => {
  window.removeEventListener('pagehide', clearKey)
  if (timer) clearTimeout(timer)
  clearKey()
})
const dirty = computed(() => privateKey.value !== '' || (name.value !== '' && !route.query.name))
const guard = useLeaveGuard(dirty, { messageKey: 'dns.dkim.import.leave' })

const INPUT =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <section class="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <PageHeader :title="lt('admin.import_private_key')" />
    <form
      v-if="capabilities.data.value"
      data-dkim-import
      class="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
      novalidate
      @submit="submit"
    >
      <ErrorSummary :id="form.summaryId" :items="form.summary.value" />
      <ProblemMessage
        v-if="form.formProblem.value"
        :problem="form.formProblem.value"
        :params="{ name: name.trim() }"
      />
      <FormField
        id="dkim-import-name"
        v-slot="field"
        :label="lt('admin.domain')"
        :errors="errorsFor('dkimName')"
        required
      >
        <input
          v-bind="field"
          v-model="name"
          type="text"
          placeholder="example.org"
          autocomplete="off"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          :class="INPUT"
        />
      </FormField>
      <button
        v-if="keyExists && !overwrite"
        type="button"
        data-switch-overwrite
        :class="buttonVariants({ variant: 'outline', class: 'self-start' })"
        @click="switchOnOverwrite"
      >
        {{ t('dns.dkim.import.switchOverwrite') }}
      </button>
      <p
        v-if="lookup === 'found' && existing?.key"
        data-import-existing
        class="text-sm text-gray-700 dark:text-gray-300"
      >
        {{
          t('dns.dkim.import.existing', {
            selector: existing.key.selector ?? '–',
            length: existing.key.keyLength
              ? formatNumber(existing.key.keyLength, locale as AppLocale)
              : '–',
          })
        }}
      </p>
      <p
        v-else-if="lookup === 'unused'"
        data-import-unused
        class="text-sm text-gray-700 dark:text-gray-300"
      >
        {{ t('dns.dkim.import.unused') }}
      </p>
      <FormField
        id="dkim-import-selector"
        v-slot="field"
        :label="lt('admin.dkim_domains_selector')"
        :errors="errorsFor('selector')"
        required
      >
        <input
          v-bind="field"
          v-model="selector"
          type="text"
          autocomplete="off"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          :class="[INPUT, 'font-mono']"
        />
      </FormField>
      <PrivateKeyField
        id="dkim-import-key"
        v-model="privateKey"
        :max-bytes="capabilities.data.value.dkim.privateKeyMaxBytes"
        :min-bits="capabilities.data.value.dkim.importKeyLengthMin"
        :max-bits="capabilities.data.value.dkim.importKeyLengthMax"
        :errors="errorsFor('privateKey')"
      />
      <label class="inline-flex min-h-11 items-center gap-2 text-gray-800 dark:text-gray-200">
        <input
          id="dkim-import-overwrite"
          v-model="overwrite"
          type="checkbox"
          class="size-5 rounded border-gray-300"
        />
        {{ lt('admin.dkim_overwrite_key') }}
      </label>
      <div
        data-sticky-save
        class="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-gray-200 bg-white px-4 py-3 sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:p-0 dark:border-gray-800 dark:bg-gray-900"
      >
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="pending"
          @click="router.push({ name: 'dkim-keys' })"
        >
          {{ lt('footer.cancel') }}
        </button>
        <button type="submit" :class="buttonVariants({ variant: 'default' })" :disabled="pending">
          {{ lt('admin.import') }}
        </button>
      </div>
    </form>
    <p
      v-else-if="capabilities.isPending.value"
      role="status"
      class="text-gray-600 dark:text-gray-400"
    >
      {{ lt('datatables.loadingRecords') }}
    </p>
    <div v-else class="flex flex-col gap-3">
      <p role="alert">{{ t('dns.capabilities.loadFailed') }}</p>
      <ProblemMessage
        :problem="problemOf(capabilities.error.value)"
        retry
        @retry="capabilities.refetch()"
      />
    </div>
  </section>
</template>
