<script setup lang="ts">
// The "Rename mailbox" tab of the classic mailbox page (#mrename, "⚠️" as legacy's tab): legacy's
// backup warning and its "I have created a backup" checkbox, then the form: the new local part
// prefilled with the current one before "@domain", "Create alias automatically" checked, and
// "Save changes". The new address opens with legacy's `success.mailbox_renamed`. A name already in
// use, an inactive mailbox, the alias limit, a changed mailbox and a temporary failure change
// nothing and say so; an incomplete rename or an unknown outcome leaves a report until it is
// dismissed (FR-048 to FR-052). One request at a time (FR-066).
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { problemOf, queryKeys, type ApiProblem } from '@/api'
import { legacy, lt, resolveText, type TextRef } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import EditableSection from '@/shared/components/EditableSection.vue'
import FormField from '@/shared/components/FormField.vue'
import { buttonVariants } from '@/shared/ui/button'

import { renameMailbox } from '../../api'
import { setMailboxFlash } from '../../flash'
import { mailboxProblem, renameReport, type RenameReportView } from '../../problems'
import type { Mailbox } from '../../types'
import RenameReport from '../dialogs/RenameReport.vue'
import LegacyCheckbox from '../fields/LegacyCheckbox.vue'

const props = defineProps<{ mailbox: Mailbox }>()
const emit = defineEmits<{ dirty: [value: boolean] }>()
const { t } = useI18n()
const { problemMessage } = useProblemMessages()
const client = useQueryClient()
const router = useRouter()

const agreed = ref(false)
const localPart = ref(props.mailbox.localPart)
const keepAlias = ref(true)
const busy = ref(false)
const fieldErrors = ref<TextRef[]>([])
const formError = ref<string | null>(null)
const report = ref<{ view: RenameReportView; message: string } | null>(null)

watch(
  () => props.mailbox.address,
  () => {
    localPart.value = props.mailbox.localPart
    agreed.value = false
  },
)
watch(
  () => agreed.value && localPart.value.trim() !== props.mailbox.localPart,
  (value) => emit('dirty', value),
)

const errors = computed(() => fieldErrors.value.map((item) => resolveText(item, t)))

function show(problem: ApiProblem, newLocalPart: string) {
  const domain = props.mailbox.domain
  const view = renameReport(problem, props.mailbox.address, `${newLocalPart}@${domain}`)
  if (view) {
    report.value = { view, message: problemMessage(problem) }
    return
  }
  if (problem.is('domain-alias-limit-reached')) {
    formError.value = lt('danger.max_alias_exceeded')
    return
  }
  if (problem.status === 412) {
    void client.invalidateQueries({ queryKey: queryKeys.mailboxes.detail(props.mailbox.address) })
  }
  const mapped = mailboxProblem(problem, { localPartField: 'newLocalPart' })
  fieldErrors.value = (mapped.fields.newLocalPart ?? []).map((item) => item.key)
  if (mapped.form) formError.value = resolveText(mapped.form, t)
  else if (mapped.rest) {
    const violations = mapped.rest.fieldErrors?.get('newLocalPart')
    if (violations?.some((item) => String(item.code) === 'unchanged')) {
      fieldErrors.value = [...fieldErrors.value, 'validation.unchanged']
    } else formError.value = problemMessage(mapped.rest)
  }
}

async function submit(event: Event) {
  event.preventDefault()
  if (busy.value) return
  fieldErrors.value = []
  formError.value = null
  const newLocalPart = localPart.value.trim()
  if (newLocalPart === '') {
    fieldErrors.value = [legacy('danger.mailbox_invalid')]
    return
  }
  if (newLocalPart.toLowerCase() === props.mailbox.localPart) {
    fieldErrors.value = ['validation.unchanged']
    return
  }
  busy.value = true
  try {
    const renamed = await renameMailbox(
      client,
      props.mailbox.address,
      { newLocalPart, keepOldAddressAsAlias: keepAlias.value },
      props.mailbox.etag,
    )
    emit('dirty', false)
    setMailboxFlash(renamed.address, [
      {
        kind: 'success',
        text: legacy('success.mailbox_renamed', renamed.previousAddress, renamed.address),
      },
    ])
    await router.push({ name: 'mailbox-detail', params: { address: renamed.address } })
  } catch (error) {
    const problem = problemOf(error)
    if (problem) show(problem, newLocalPart.toLowerCase())
    else throw error
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <EditableSection
    section-id="rename"
    :title="`⚠️ ${lt('edit.mailbox_rename')}`"
    :editable="false"
    :editing="false"
  >
    <div class="flex flex-col gap-4">
      <RenameReport
        v-if="report"
        :report="report.view"
        :message="report.message"
        @dismiss="report = null"
      />
      <p class="text-gray-800 dark:text-gray-200">{{ lt('edit.mailbox_rename_warning') }}</p>
      <LegacyCheckbox id="rename-agree" v-model="agreed" label-key="edit.mailbox_rename_agree" />
      <form v-if="agreed" class="flex flex-col gap-4" novalidate @submit="submit">
        <p
          v-if="formError"
          role="alert"
          data-form-error
          class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {{ formError }}
        </p>
        <FormField
          id="rename-local-part"
          v-slot="field"
          :label="lt('edit.mailbox_rename_title')"
          :errors="errors"
        >
          <div class="flex min-w-0">
            <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
            <input
              v-bind="field"
              v-model="localPart"
              type="text"
              autocomplete="off"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
              maxlength="64"
              class="h-11 min-w-0 flex-1 rounded-s-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            <span
              class="inline-flex max-w-[50%] items-center rounded-e-lg border border-s-0 border-gray-300 bg-gray-50 px-3 text-gray-700 wrap-anywhere dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >@{{ mailbox.domainUnicode }}</span
            >
          </div>
        </FormField>
        <LegacyCheckbox
          id="rename-alias"
          v-model="keepAlias"
          label-key="edit.mailbox_rename_alias"
        />
        <div>
          <button
            type="submit"
            :class="buttonVariants({ variant: 'default' })"
            :disabled="busy"
            :aria-busy="busy ? 'true' : undefined"
          >
            {{ lt('edit.save') }}
          </button>
        </div>
      </form>
    </div>
  </EditableSection>
</template>
