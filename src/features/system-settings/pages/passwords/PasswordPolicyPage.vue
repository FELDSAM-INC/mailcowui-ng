<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  problemOf,
  queryKeys,
  type PasswordPolicy,
  type PasswordPolicyPatch,
  type SettingsCapabilities,
} from '@/api'
import { lt } from '@/i18n'
import EditableSection from '@/shared/components/EditableSection.vue'
import FormField from '@/shared/components/FormField.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'

import { passwordPolicyOptions, updatePasswordPolicy, usePasswordPolicy } from '../../api/passwords'
import PolicyRulesPreview from '../../components/passwords/PolicyRulesPreview.vue'
import { useSettingsSection } from '../../composables/useSettingsSection'

const props = defineProps<{ capabilities: SettingsCapabilities }>()
const { t } = useI18n()
const client = useQueryClient()
const query = usePasswordPolicy()
// password_complexity('get') supplies this order to the classic form's foreach.
const checkboxes = [
  { field: 'requireLetters', label: 'admin.password_policy_chars' },
  { field: 'requireSpecialCharacters', label: 'admin.password_policy_special_chars' },
  { field: 'requireMixedCase', label: 'admin.password_policy_lowerupper' },
  { field: 'requireDigits', label: 'admin.password_policy_numbers' },
] as const
type Draft = Omit<PasswordPolicy, 'etag' | 'minLength'> & { minLength: string | number }
const fields = ['minLength', ...checkboxes.map((item) => item.field)] as const
function toDraft({ etag: _etag, ...resource }: PasswordPolicy): Draft {
  return resource
}
function toPatch(draft: Draft, base: PasswordPolicy): PasswordPolicyPatch | null {
  const patch: PasswordPolicyPatch = {}
  const minLength = Number(draft.minLength)
  if (minLength !== base.minLength) patch.minLength = minLength
  for (const { field } of checkboxes) if (draft[field] !== base[field]) patch[field] = draft[field]
  return Object.keys(patch).length ? patch : null
}
const section = useSettingsSection({
  resource: () => query.data.value,
  key: queryKeys.passwordPolicy(),
  fields,
  refetch: () => client.fetchQuery({ ...passwordPolicyOptions(), staleTime: 0 }),
  toDraft,
  toPatch,
  send: updatePasswordPolicy,
  allowed: () => !props.capabilities.demoMode,
  fieldId: (path) => (fields.some((field) => field === path) ? `policy-${path}` : null),
  success: () => lt('success.password_policy_saved'),
})
const { editing, draft, dirty, saving, outdated, status, problem } = section
const rules = computed(() =>
  editing.value && draft.value
    ? { ...draft.value, minLength: Number(draft.value.minLength) }
    : query.data.value,
)
const changes = computed(() =>
  section.changes.value.map((change) => ({
    field: String(change.field),
    label:
      change.field === 'minLength'
        ? lt('admin.password_length')
        : lt(checkboxes.find((item) => item.field === change.field)!.label),
    saved:
      typeof change.savedValue === 'boolean'
        ? t(change.savedValue ? 'lists.filters.yes' : 'lists.filters.no')
        : String(change.savedValue),
  })),
)
async function save(retry = false) {
  if (!draft.value || saving.value || props.capabilities.demoMode) return
  const { passwordPolicyMinLength: min, passwordPolicyMaxLength: max } = props.capabilities.limits
  const value = Number(draft.value.minLength)
  if (
    String(draft.value.minLength).trim() === '' ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    await section.form.setClientMessages({ minLength: [t('validation.outOfRange', { min, max })] })
    return
  }
  if (retry) await section.saveAgain()
  else await section.save()
}
useLeaveGuard(
  computed(() => dirty.value || saving.value),
  'leaveGuard.body',
)
</script>

<template>
  <section class="flex min-w-0 flex-col gap-4">
    <PageHeader :title="lt('admin.password_settings')">
      <template #actions><HistoryLink target-type="passwordPolicy" /></template>
    </PageHeader>
    <p v-if="query.isPending.value" role="status" aria-busy="true">{{ lt('footer.loading') }}</p>
    <ProblemMessage
      v-else-if="!query.data.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <template v-else>
      <p
        v-if="capabilities.demoMode"
        data-demo-mode
        role="status"
        class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        {{ lt('danger.demo_mode_enabled') }}
      </p>
      <EditableSection
        section-id="policy"
        :title="lt('admin.password_policy')"
        :editable="!capabilities.demoMode"
        :editing="editing"
        :saving="saving"
        :status="status"
        :outdated="changes"
        :version-changed="outdated"
        :can-save="!capabilities.demoMode"
        :save-label="lt('admin.save')"
        @edit="section.open"
        @save="save()"
        @save-again="save(true)"
        @discard="section.discard"
        @cancel="section.discard"
      >
        <dl class="space-y-3">
          <div>
            <dt class="text-sm text-gray-600 dark:text-gray-400">
              {{ lt('admin.password_length') }}
            </dt>
            <dd data-policy-length>{{ query.data.value.minLength }}</dd>
          </div>
          <div v-for="item in checkboxes" :key="item.field">
            <dt class="text-sm text-gray-600 dark:text-gray-400">{{ lt(item.label) }}</dt>
            <dd>
              {{ t(query.data.value[item.field] ? 'lists.filters.yes' : 'lists.filters.no') }}
            </dd>
          </div>
        </dl>
        <template #form>
          <div v-if="draft" data-policy-form class="flex flex-col gap-4">
            <ProblemMessage :problem="section.form.formProblem.value ?? problem" />
            <FormField
              id="policy-minLength"
              :label="lt('admin.password_length')"
              :errors="section.form.errorsFor('minLength')"
            >
              <template #default="control"
                ><input
                  v-bind="control"
                  v-model="draft.minLength"
                  name="minLength"
                  type="number"
                  inputmode="numeric"
                  step="1"
                  :min="capabilities.limits.passwordPolicyMinLength"
                  :max="capabilities.limits.passwordPolicyMaxLength"
                  :disabled="saving || capabilities.demoMode"
                  class="min-h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500 sm:max-w-48 dark:border-gray-600 dark:text-white"
              /></template>
            </FormField>
            <label
              v-for="item in checkboxes"
              :key="item.field"
              class="flex min-h-11 items-center gap-3 text-gray-700 dark:text-gray-300"
            >
              <input
                :id="`policy-${item.field}`"
                v-model="draft[item.field]"
                :name="item.field"
                type="checkbox"
                :disabled="saving || capabilities.demoMode"
                class="size-5 shrink-0 accent-brand-600"
              />
              {{ lt(item.label) }}
            </label>
          </div>
        </template>
      </EditableSection>
      <section
        id="policy-rules"
        aria-labelledby="policy-rules-title"
        class="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 id="policy-rules-title" class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('systemSettings.passwordPolicy.rules') }}
        </h2>
        <PolicyRulesPreview v-if="rules" :policy="rules" />
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('systemSettings.passwordPolicy.existingPasswords') }}
        </p>
      </section>
    </template>
  </section>
</template>
