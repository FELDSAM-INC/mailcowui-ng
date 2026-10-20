<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import {
  problemOf,
  queryKeys,
  type LegacyApiCorsSettingsPatch,
  type SettingsCapabilities,
} from '@/api'
import { lt } from '@/i18n'
import EditableSection from '@/shared/components/EditableSection.vue'
import FormField from '@/shared/components/FormField.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { buttonVariants } from '@/shared/ui/button'
import { CORS_ORIGIN_MAX_LENGTH } from '@/shared/validation/limits'
import { corsOptions, updateCors, useCors } from '../../api/cors'
import { useSettingsSection } from '../../composables/useSettingsSection'
import { isOrigin, parseOrigins } from '../../lib/origin'
const props = defineProps<{ capabilities: SettingsCapabilities }>()
const { t } = useI18n(),
  client = useQueryClient(),
  query = useCors()
const methods = ['POST', 'GET', 'DELETE', 'PUT'] as const
const section = useSettingsSection({
  resource: () => query.data.value,
  key: queryKeys.legacyApiCors(),
  fields: ['allowedOrigins', 'allowedMethods'],
  refetch: () => client.fetchQuery({ ...corsOptions(), staleTime: 0 }),
  toDraft: (resource) => ({
    origins: resource.allowedOrigins.join('\n'),
    methods: [...resource.allowedMethods],
  }),
  toPatch: (draft, base) => {
    const patch: LegacyApiCorsSettingsPatch = {}
    const origins = parseOrigins(draft.origins)
    if (JSON.stringify(origins) !== JSON.stringify(base.allowedOrigins))
      patch.allowedOrigins = origins
    if (JSON.stringify(draft.methods) !== JSON.stringify(base.allowedMethods))
      patch.allowedMethods = draft.methods
    return Object.keys(patch).length ? patch : null
  },
  send: updateCors,
  success: () => lt('success.cors_headers_edited'),
  fieldId: (path) =>
    path.startsWith('allowedOrigins')
      ? 'cors-origins'
      : path.startsWith('allowedMethods')
        ? 'cors-methods'
        : null,
})
const { editing, draft, dirty, saving, status, outdated, problem } = section
const origins = computed(() => parseOrigins(draft.value?.origins ?? ''))
const originErrors = computed(() => {
  const errors = origins.value.flatMap((value) =>
    [...value].length > CORS_ORIGIN_MAX_LENGTH
      ? [t('validation.tooLong', { max: CORS_ORIGIN_MAX_LENGTH })]
      : isOrigin(value)
        ? []
        : [lt('danger.cors_invalid_origin') + ': ' + value],
  )
  if (origins.value.length > props.capabilities.limits.corsOriginsMax)
    errors.push(t('validation.tooMany', { max: props.capabilities.limits.corsOriginsMax }))
  return errors
})
const methodErrors = computed(() =>
  draft.value && !draft.value.methods.length ? [lt('danger.cors_invalid_method')] : [],
)
const wildcard = computed(() =>
  editing.value ? origins.value.includes('*') : query.data.value?.allowedOrigins.includes('*'),
)
const changes = computed(() =>
  section.changes.value.map((change) => ({
    field: String(change.field),
    label: lt(
      change.field === 'allowedOrigins' ? 'admin.allowed_origins' : 'admin.allowed_methods',
    ),
    saved: Array.isArray(change.savedValue)
      ? change.savedValue.join(', ')
      : String(change.savedValue),
  })),
)
function serverErrors(field: string) {
  return [...(problem.value?.fieldErrors.keys() ?? [])]
    .filter((path) => path === field || path.startsWith(field + '.'))
    .flatMap((path) => {
      const violations = problem.value?.fieldErrors.get(path) ?? []
      return violations.some((v) => ['invalidFormat', 'notInList'].includes(v.code))
        ? [
            lt(
              field === 'allowedOrigins'
                ? 'danger.cors_invalid_origin'
                : 'danger.cors_invalid_method',
            ),
          ]
        : section.form.errorsFor(path)
    })
}
async function save(again = false) {
  await section.form.setClientMessages({
    allowedOrigins: originErrors.value,
    allowedMethods: methodErrors.value,
  })
  if (originErrors.value.length || methodErrors.value.length) return
  if (again) await section.saveAgain()
  else await section.save()
}
useLeaveGuard(
  computed(() => dirty.value || saving.value),
  'leaveGuard.body',
)
</script>
<template>
  <section class="flex min-w-0 flex-col gap-4">
    <RouterLink
      :to="{ name: 'system-settings' }"
      :class="buttonVariants({ variant: 'link', class: 'self-start' })"
      >{{ t('nav.system') }}</RouterLink
    >
    <PageHeader :title="lt('admin.cors_settings')"
      ><template #actions><HistoryLink target-type="legacyApiCors" /></template
    ></PageHeader>
    <p>{{ t('systemSettings.cors.scope') }}</p>
    <p v-if="query.isPending.value" role="status" aria-busy="true">{{ lt('footer.loading') }}</p>
    <ProblemMessage
      v-else-if="!query.data.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <template v-else>
      <p data-cors-default>
        {{ t('systemSettings.cors.empty', { origin: query.data.value.serverOrigin }) }}
      </p>
      <p
        v-if="wildcard"
        data-cors-wildcard
        role="status"
        class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
      >
        {{ t('systemSettings.cors.wildcard') }}
      </p>
      <EditableSection
        editable
        section-id="cors"
        :title="lt('admin.cors_settings')"
        :editing="editing"
        :saving="saving"
        :status="status"
        :outdated="changes"
        :version-changed="outdated"
        :save-label="lt('admin.save')"
        @edit="section.open"
        @save="save()"
        @save-again="save(true)"
        @discard="section.discard"
        @cancel="section.discard"
      >
        <dl data-cors-value class="flex flex-col gap-3">
          <div>
            <dt class="font-medium">{{ lt('admin.allowed_origins') }}</dt>
            <dd class="whitespace-pre-wrap break-all">
              {{ query.data.value.allowedOrigins.join('\n') || query.data.value.serverOrigin }}
            </dd>
          </div>
          <div>
            <dt class="font-medium">{{ lt('admin.allowed_methods') }}</dt>
            <dd>{{ query.data.value.allowedMethods.join(', ') }}</dd>
          </div>
        </dl>
        <template #form>
          <div v-if="draft" class="flex flex-col gap-4">
            <ProblemMessage :problem="section.form.formProblem.value" />
            <FormField
              id="cors-origins"
              :label="lt('admin.allowed_origins')"
              :errors="[...originErrors, ...serverErrors('allowedOrigins')]"
            >
              <template #default="control">
                <textarea
                  v-bind="control"
                  v-model="draft.origins"
                  name="allowed_origins"
                  rows="7"
                  autocapitalize="off"
                  autocorrect="off"
                  autocomplete="off"
                  :spellcheck="false"
                  :disabled="saving"
                  class="min-h-44 w-full rounded-lg border border-gray-300 bg-transparent p-3 font-mono text-sm dark:border-gray-600"
                />
              </template>
            </FormField>
            <FormField
              id="cors-methods"
              :label="lt('admin.allowed_methods')"
              :errors="[...methodErrors, ...serverErrors('allowedMethods')]"
            >
              <template #default="control"
                ><select
                  v-bind="control"
                  v-model="draft.methods"
                  name="allowed_methods"
                  multiple
                  :size="4"
                  :disabled="saving"
                  class="min-h-44 w-full rounded-lg border border-gray-300 bg-white p-2 dark:border-gray-600 dark:bg-gray-900"
                >
                  <option
                    v-for="method in methods"
                    :key="method"
                    :value="method"
                    class="min-h-11 p-3"
                  >
                    {{ method }}
                  </option>
                </select></template
              >
            </FormField>
          </div>
        </template>
      </EditableSection>
    </template>
  </section>
</template>
