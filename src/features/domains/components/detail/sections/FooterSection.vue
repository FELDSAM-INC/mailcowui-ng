<script setup lang="ts">
// The "Domain wide footer" tab of the classic domain page (`templates/edit/domain.twig` #dfooter) as
// a section with its own save (UI 002 US7, FR-057 to FR-062): legacy's explanation and variables,
// "Exclude from footer" (the domain's mailboxes, aliases and alias domains), "Ignore footer on reply
// e-mails" and the HTML and plain footers as source that is never rendered (FR-059). Administrators
// and the domain's domain administrators edit it.
import { useQuery } from '@tanstack/vue-query'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt, type LegacyKey } from '@/i18n'
import type { Domain, DomainCapabilities } from '@/api'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'

import { footerOptions, problemOf } from '../../../api'
import { useFooterSection } from '../../../composables/useFooterSection'
import { useDomainFormat } from '../../../format'
import ExclusionSelect from '../../footer/ExclusionSelect.vue'
import SectionProblem from '../SectionProblem.vue'

const props = withDefaults(
  defineProps<{
    domain: Domain
    editable: boolean
    editing?: boolean
    editDisabledReason?: string | null
    capabilities?: DomainCapabilities
  }>(),
  { editing: false, editDisabledReason: null, capabilities: undefined },
)
const emit = defineEmits<{
  (event: 'edit'): void
  (event: 'close'): void
  (event: 'dirty', value: boolean): void
}>()
const { t } = useI18n()
const format = useDomainFormat()

const query = useQuery(computed(() => footerOptions(props.domain.name)))
const footer = computed(() => query.data.value)

const s = useFooterSection({
  domain: () => props.domain.name,
  footer: () => footer.value,
  editing: () => props.editing,
  maxBytes: () => props.capabilities?.footerTextMaxBytes ?? 1_048_576,
  onSaved: () => {
    emit('dirty', false)
    emit('close')
  },
})
watch(
  () => s.dirty.value,
  (value) => emit('dirty', value),
)

/** Legacy's variables, one per line in a `<pre>` (`templates/edit/domain.twig` #dfooter). */
const VARIABLES: readonly LegacyKey[] = [
  'edit.domain_footer_info_vars.auth_user',
  'edit.domain_footer_info_vars.from_user',
  'edit.domain_footer_info_vars.from_name',
  'edit.domain_footer_info_vars.from_addr',
  'edit.domain_footer_info_vars.from_domain',
  'edit.domain_footer_info_vars.custom',
]

/** Errors of single exclusions, named by their entry (FR-058). */
const exclusionErrors = computed(() => {
  const values = s.form.value
  if (!values) return []
  const messages = [...s.errorsFor('excludedAddresses'), ...s.errorsFor('excludedAliasDomains')]
  for (const item of s.problemForm.summary.value) {
    const match = /^(excludedAddresses|excludedAliasDomains)\.(\d+)$/.exec(item.path)
    if (!match) continue
    const entry = values[match[1] as 'excludedAddresses' | 'excludedAliasDomains'][Number(match[2])]
    for (const message of item.messages) messages.push(entry ? `${entry}: ${message}` : message)
  }
  return messages
})

const TEXTAREA =
  'min-h-48 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
</script>

<template>
  <EditableSection
    section-id="footer"
    :title="lt('edit.domain_footer')"
    :editable="editable"
    :editing="editing"
    :edit-disabled-reason="editDisabledReason"
    :saving="s.pending.value"
    :status="s.status.value"
    :outdated="s.outdated.value"
    :save-label="lt('edit.save')"
    @edit="emit('edit')"
    @cancel="emit('close')"
    @save="s.save"
    @save-again="s.saveAgain"
    @discard="s.discard"
  >
    <p v-if="query.isPending.value" class="text-sm text-gray-600 dark:text-gray-400">
      {{ lt('datatables.loadingRecords') }}
    </p>
    <SectionProblem
      v-else-if="query.isError.value"
      :problem="problemOf(query.error.value)"
      @retry="query.refetch()"
    />
    <dl v-else-if="footer" data-footer-values class="grid grid-cols-1 gap-3 text-sm">
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('edit.footer_exclude') }}</dt>
        <dd class="break-words text-gray-900 dark:text-white">
          {{
            format.list([...footer.excludedAddresses, ...footer.excludedAliasDomains]) ||
            t('domains.values.none')
          }}
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">
          {{ lt('edit.domain_footer_skip_replies') }}
        </dt>
        <dd class="text-gray-900 dark:text-white">{{ format.yesNo(footer.skipReplies) }}</dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('edit.domain_footer_html') }}</dt>
        <dd>
          <pre
            data-footer-html
            class="max-h-48 overflow-auto rounded-lg bg-gray-50 p-2 text-xs break-all whitespace-pre-wrap text-gray-900 dark:bg-gray-950 dark:text-white"
            >{{ footer.html }}</pre>
        </dd>
      </div>
      <div>
        <dt class="text-gray-600 dark:text-gray-400">{{ lt('edit.domain_footer_plain') }}</dt>
        <dd>
          <pre
            class="max-h-48 overflow-auto rounded-lg bg-gray-50 p-2 text-xs break-all whitespace-pre-wrap text-gray-900 dark:bg-gray-950 dark:text-white"
            >{{ footer.plain }}</pre>
        </dd>
      </div>
    </dl>
    <template #form>
      <template v-if="s.form.value">
        <ErrorSummary :id="s.problemForm.summaryId" :items="s.problemForm.summary.value" />
        <SectionProblem :problem="s.problem.value" @retry="s.save" />
        <LegacyText
          k="edit.domain_footer_info"
          as="p"
          data-footer-info
          class="text-sm text-gray-700 dark:text-gray-300"
        />
        <!-- prettier-ignore -->
        <pre
          data-footer-variables
          class="overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs whitespace-pre-wrap text-gray-800 dark:bg-gray-950 dark:text-gray-200"
        ><template v-for="(name, index) in VARIABLES" :key="name"><template v-if="index > 0">{{ '\n' }}</template><LegacyText :k="name" /></template></pre>
        <ExclusionSelect
          id="section-footer-exclude"
          :domain="domain.name"
          :addresses="s.form.value.excludedAddresses"
          :alias-domains="s.form.value.excludedAliasDomains"
          :errors="exclusionErrors"
          @update:addresses="s.form.value.excludedAddresses = $event"
          @update:alias-domains="s.form.value.excludedAliasDomains = $event"
        />
        <label
          class="flex min-h-11 cursor-pointer items-center gap-3 text-gray-800 dark:text-gray-200"
        >
          <input
            id="section-footer-skipReplies"
            v-model="s.form.value.skipReplies"
            type="checkbox"
            class="size-5 shrink-0 accent-accent"
          />
          <span>{{ lt('edit.domain_footer_skip_replies') }}</span>
        </label>
        <FormField
          id="section-footer-html"
          :label="lt('edit.domain_footer_html')"
          :errors="s.errorsFor('html')"
        >
          <template #default="control">
            <textarea
              v-bind="control"
              v-model="s.form.value.html"
              rows="10"
              spellcheck="false"
              autocorrect="off"
              autocapitalize="none"
              :class="TEXTAREA"
            />
          </template>
        </FormField>
        <FormField
          id="section-footer-plain"
          :label="lt('edit.domain_footer_plain')"
          :errors="s.errorsFor('plain')"
        >
          <template #default="control">
            <textarea
              v-bind="control"
              v-model="s.form.value.plain"
              rows="10"
              spellcheck="false"
              autocorrect="off"
              autocapitalize="none"
              :class="TEXTAREA"
            />
          </template>
        </FormField>
      </template>
      <p v-else class="text-sm text-gray-600 dark:text-gray-400">
        {{ lt('datatables.loadingRecords') }}
      </p>
    </template>
  </EditableSection>
</template>
