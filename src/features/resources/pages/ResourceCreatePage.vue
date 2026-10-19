<script setup lang="ts">
// "Add resource" (US7, FR-044, FR-045, FR-047), the classic `#addResourceModal` as a full-screen
// form, in its order and with its texts: description with the derived address as a live preview
// (legacy derives it silently), domain (domains only), kind (legacy's "Please select..." until
// chosen), multiple bookings (legacy's select, and the number for a hard limit), active, "Add". It
// waits for the capabilities (FR-071); without a derivable address it cannot be submitted. A created
// resource opens with legacy's `success.resource_added`; refusals use legacy's messages at their
// fields, an address in use at the description (US7-AS2). The input survives a session expiry in
// this tab (research R10), and leaving with input asks first.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { problemOf, type AliasCapabilities } from '@/api'
import { CapabilitiesGate, domainPickerSource } from '@/features/aliases'
import { lt } from '@/i18n'
import DomainPicker from '@/shared/components/DomainPicker.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useFormDraft } from '@/shared/composables/useFormDraft'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useStickyBarFocus } from '@/shared/composables/useStickyBarFocus'
import { buttonVariants } from '@/shared/ui/button'

import { previewAddress } from '../address-preview'
import { createResource } from '../api'
import { checkBookingLimit } from '../booking'
import AddressPreview from '../components/AddressPreview.vue'
import BookingRuleField from '../components/BookingRuleField.vue'
import KindSelect from '../components/KindSelect.vue'
import { setResourceFlash } from '../flash'
import { createFormDefaults, toCreateRequest, type ResourceCreateForm } from '../resource-form'

const ID = 'resource'

useStickyBarFocus()

const { t } = useI18n()
const router = useRouter()
const queryClient = useQueryClient()

const form = ref<ResourceCreateForm>(createFormDefaults())
const labels = ref<Record<string, string>>({})
const pending = ref(false)
const sources = [domainPickerSource()]

const problems = useProblemForm({
  formKey: 'resources.form',
  fieldId: (path) => {
    if (path === 'description') return `${ID}-description`
    if (path === 'domain') return `${ID}-domain`
    if (path === 'kind') return `${ID}-kind`
    if (path === 'bookingRule') return `${ID}-bookingRule`
    if (path === 'bookingLimit') return `${ID}-bookingLimit`
    return null
  },
  valueAt: (path) =>
    path === 'description'
      ? form.value.description.trim()
      : path === 'domain'
        ? (form.value.domain ?? '')
        : undefined,
  problemFields: { 'address-in-use': 'description' },
  problemParams: () => ({ address: address.value ?? '' }),
})

const domainUnicode = computed(() =>
  form.value.domain ? (labels.value[form.value.domain] ?? form.value.domain) : null,
)
/** The ASCII address the server will derive, for legacy's messages. */
const address = computed(() => previewAddress(form.value.description, form.value.domain))
const derivable = computed(() => previewAddress(form.value.description, null) !== null)

const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(createFormDefaults()))
const guard = useLeaveGuard(dirty, { messageKey: 'leaveGuard.body' })
const draft = useFormDraft('resource-create', {
  capture: () => ({ ...form.value }),
  restore: (value: ResourceCreateForm) => {
    form.value = { ...createFormDefaults(), ...value }
  },
  dirty: () => dirty.value,
})

function update<K extends keyof ResourceCreateForm>(key: K, value: ResourceCreateForm[K]) {
  form.value = { ...form.value, [key]: value }
}

/** The client checks, as input aids; the server decides everything else. */
function check(capabilities: AliasCapabilities): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  const description = form.value.description.trim()
  const max = capabilities.resourceDescriptionMaxLength
  if (description === '') errors.description = [t('validation.required')]
  else if ([...description].length > max) errors.description = [t('validation.tooLong', { max })]
  if (!form.value.domain) errors.domain = [t('validation.required')]
  if (form.value.kind === '') errors.kind = [t('validation.required')]
  if (form.value.bookingRule === 'limited') {
    const wrong = checkBookingLimit(form.value.bookingLimitText, capabilities.resourceBookingLimit)
    if (wrong) errors.bookingLimit = [t('validation.outOfRange', wrong)]
  }
  return errors
}

async function submit(capabilities: AliasCapabilities) {
  if (pending.value || !derivable.value) return
  const errors = check(capabilities)
  if (Object.keys(errors).length > 0) {
    await problems.setClientMessages(errors)
    return
  }
  problems.clear()
  pending.value = true
  announce(t('sections.saving'))
  try {
    const resource = await createResource(queryClient, toCreateRequest(form.value))
    setResourceFlash(resource.address, lt('success.resource_added', resource.address))
    draft.clear()
    guard.disarm()
    await router.push({ name: 'resource-detail', params: { resourceAddress: resource.address } })
  } catch (error) {
    await problems.setProblem(problemOf(error))
  } finally {
    pending.value = false
  }
}

const retryable = computed(() => problems.formProblem.value?.kind === 'network')
const INPUT =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <section class="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <PageHeader :title="lt('mailbox.add_resource')" />
    <CapabilitiesGate v-slot="{ capabilities }">
      <form
        data-resource-form
        class="flex min-w-0 flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
        novalidate
        @submit.prevent="submit(capabilities)"
      >
        <ErrorSummary :id="problems.summaryId" :items="problems.summary.value" />
        <ProblemMessage
          :problem="problems.formProblem.value"
          :retry="retryable"
          @retry="submit(capabilities)"
        />
        <FormField
          :id="`${ID}-description`"
          :label="lt('add.description')"
          :errors="problems.errorsFor('description')"
        >
          <template #default="control">
            <input
              v-bind="control"
              :value="form.description"
              type="text"
              autocomplete="off"
              :aria-describedby="
                [control['aria-describedby'], `${ID}-preview`].filter(Boolean).join(' ')
              "
              :class="INPUT"
              @input="update('description', ($event.target as HTMLInputElement).value)"
            />
          </template>
        </FormField>
        <AddressPreview
          :id="`${ID}-preview`"
          class="-mt-3"
          :description="form.description"
          :domain-unicode="domainUnicode"
        />
        <DomainPicker
          :id="`${ID}-domain`"
          :label="lt('add.domain')"
          :placeholder="lt('add.select')"
          :sources="sources"
          :model-value="form.domain"
          :labels="labels"
          :errors="problems.errorsFor('domain')"
          @pick="labels = { ...labels, [$event.name]: $event.nameUnicode }"
          @update:model-value="update('domain', ($event as string | null) ?? null)"
        />
        <KindSelect
          :id="`${ID}-kind`"
          label-key="add.kind"
          :model-value="form.kind"
          :errors="problems.errorsFor('kind')"
          @update:model-value="update('kind', $event)"
        />
        <BookingRuleField
          :id-prefix="ID"
          :rule="form.bookingRule"
          :limit-text="form.bookingLimitText"
          :range="capabilities.resourceBookingLimit"
          :errors="problems.errorsFor('bookingRule')"
          :limit-errors="problems.errorsFor('bookingLimit')"
          @update:rule="update('bookingRule', $event)"
          @update:limit-text="update('bookingLimitText', $event)"
        />
        <label class="inline-flex min-h-11 items-center gap-3 text-gray-800 dark:text-gray-200">
          <input
            :id="`${ID}-active`"
            type="checkbox"
            class="size-5 accent-brand-500"
            :checked="form.active"
            @change="update('active', ($event.target as HTMLInputElement).checked)"
          />
          {{ lt('add.active') }}
        </label>
        <div
          data-sticky-save
          class="sticky bottom-0 z-10 -mx-4 flex flex-wrap gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 sm:-mx-5 sm:px-5 dark:border-gray-800 dark:bg-gray-900/95"
        >
          <button
            type="submit"
            :class="buttonVariants({ variant: 'default' })"
            :disabled="pending || !derivable"
            :aria-busy="pending ? 'true' : 'false'"
          >
            {{ lt('admin.add') }}
          </button>
        </div>
      </form>
    </CapabilitiesGate>
  </section>
</template>
