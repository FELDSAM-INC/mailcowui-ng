<script setup lang="ts">
// The MTA-STS section of the domain page: legacy's `#dmtasts` tab (`templates/edit/domain.twig`) as
// a section with its own save (FR-046 to FR-053 as settled in the legacy form map). The read view
// shows legacy's explanation, the policy with its identifier, address, text and DNS records, or
// that no policy is set up; Edit opens legacy's form (set-up when there is no policy). After a save
// that renewed the identifier, a notice names the old and new identifier and the `_mta-sts` record
// stays highlighted until the page is left. History is for administrators (US8). Reached with the
// hash `#mta-sts` from the MTA-STS policies and the alias domain page.
import { computed, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { problemOf } from '@/api'
import { canAccess } from '@/app/navigation/visibility'
import { lt } from '@/i18n'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { InfoIcon, WarningIcon } from '@/shared/icons'

import { useDnsCapabilities } from '../api/capabilities'
import { useMtaStsPolicy } from '../api/mta-sts'
import { useDnsRole } from '../composables/useDnsRole'
import { useMtaStsSection } from '../mta-sts/section'
import MtaStsForm from './MtaStsForm.vue'
import MtaStsPolicyFacts from './MtaStsPolicyFacts.vue'
import MtaStsRecords from './MtaStsRecords.vue'

const props = defineProps<{ domain: string }>()
const { t } = useI18n()
const route = useRoute()
const { identity } = useDnsRole()
const capabilities = useDnsCapabilities()
const query = useMtaStsPolicy(() => props.domain)
const policy = computed(() => query.data.value)
const historyAllowed = computed(() => canAccess('auditLog', identity.data.value))

function focusHeading() {
  void nextTick(() => document.getElementById('section-mta-sts-title')?.focus())
}

const s = useMtaStsSection({
  domain: () => props.domain,
  policy: () => policy.value,
  caps: () => capabilities.data.value,
  refetch: async () => (await query.refetch()).data,
  onSaved: focusHeading,
})

const editable = computed(
  () => !!capabilities.data.value && query.data.value !== undefined && !query.isError.value,
)

// Reached with `#mta-sts` (the policies list, the alias domain page): the section loads after the
// page, so it scrolls itself into view and takes the focus once its policy is known.
let arrived = false
watch(
  () => [route.hash, query.isPending.value] as const,
  ([hash, loading]) => {
    if (arrived || loading || hash !== '#mta-sts') return
    arrived = true
    void nextTick(() => {
      document.getElementById('mta-sts')?.scrollIntoView({ block: 'start' })
      focusHeading()
    })
  },
  { immediate: true },
)
</script>

<template>
  <div id="mta-sts" data-mta-sts-section class="scroll-mt-20">
    <EditableSection
      section-id="mta-sts"
      :title="lt('edit.mta_sts')"
      :editable="editable"
      :editing="s.editing.value"
      :saving="s.pending.value"
      :status="s.status.value"
      :outdated="s.outdated.value"
      :save-label="lt('admin.save')"
      @edit="s.open"
      @cancel="s.close"
      @save="s.save"
      @save-again="s.saveAgain"
      @discard="s.discard"
    >
      <template #header-actions>
        <HistoryLink
          v-if="!s.editing.value"
          :target-id="domain"
          target-type="mtaStsPolicy"
          :allowed="historyAllowed"
        />
      </template>
      <div class="flex flex-col gap-4">
        <LegacyText k="edit.mta_sts_info" as="p" class="text-sm text-gray-700 dark:text-gray-300" />
        <p v-if="query.isPending.value" class="text-sm text-gray-600 dark:text-gray-400">
          {{ lt('datatables.loadingRecords') }}
        </p>
        <div v-else-if="query.isError.value && policy === undefined" class="flex flex-col gap-2">
          <p role="alert" class="font-medium text-gray-900 dark:text-white">
            {{ t('dns.mtaSts.loadFailed') }}
          </p>
          <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
        </div>
        <p v-else-if="!policy" data-mta-sts-none class="text-gray-800 dark:text-gray-200">
          {{ t('dns.mtaSts.none') }}
        </p>
        <template v-else>
          <div
            v-if="s.idChange.value"
            data-policy-id-notice
            role="status"
            class="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
          >
            <WarningIcon class="mt-0.5 size-4 shrink-0" />
            <p class="break-words">
              {{ t('dns.mtaSts.idChanged', { ...s.idChange.value, domain: policy.domain }) }}
            </p>
          </div>
          <div
            v-if="s.activated.value"
            data-activation-notice
            role="status"
            class="flex gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100"
          >
            <InfoIcon class="mt-0.5 size-4 shrink-0" />
            <p class="break-words">
              {{ t('dns.mtaSts.certificateNotice', { domain: policy.domain }) }}
            </p>
          </div>
          <MtaStsPolicyFacts :policy="policy" />
          <MtaStsRecords :records="policy.dnsRecords" :highlight="s.idChange.value !== null" />
        </template>
      </div>
      <template #form>
        <template v-if="s.form.value && capabilities.data.value">
          <LegacyText
            k="edit.mta_sts_info"
            as="p"
            class="text-sm text-gray-700 dark:text-gray-300"
          />
          <ErrorSummary :id="s.problemForm.summaryId" :items="s.problemForm.summary.value" />
          <ProblemMessage v-if="s.problem.value" :problem="s.problem.value" />
          <ProblemMessage
            v-else-if="s.problemForm.formProblem.value"
            :problem="s.problemForm.formProblem.value"
          />
          <MtaStsForm
            v-model="s.form.value"
            :domain="domain"
            :caps="capabilities.data.value"
            :creating="!policy"
            :errors-for="s.errorsFor"
          />
        </template>
      </template>
    </EditableSection>
  </div>
</template>
