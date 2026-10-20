<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  problemOf,
  queryKeys,
  type BrandColors,
  type BrandColorsPatch,
  type SettingsCapabilities,
} from '@/api'
import { lt } from '@/i18n'
import { contrastRatio, normalizeHex } from '@/shared/color/contrast'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { brandColorsOptions, invalidateBranding, updateBrandColors } from '../../api/branding'
import { useSettingsSection } from '../../composables/useSettingsSection'
import BrandPreview from '../../components/branding/BrandPreview.vue'
import ColourField from '../../components/branding/ColourField.vue'
const props = defineProps<{ capabilities: SettingsCapabilities }>()
const { t } = useI18n(),
  client = useQueryClient(),
  query = useQuery(brandColorsOptions())
const themes = ['light', 'dark'] as const
const reference = (theme: 'light' | 'dark') =>
  theme === 'light'
    ? props.capabilities.brandColors.lightReferenceSurface
    : props.capabilities.brandColors.darkReferenceSurface
function toPatch(
  draft: Pick<BrandColors, 'light' | 'dark'>,
  before: BrandColors,
): BrandColorsPatch | null {
  const patch: BrandColorsPatch = {}
  for (const theme of themes)
    if (draft[theme] !== before[theme])
      patch[theme] = draft[theme] ? (normalizeHex(draft[theme]) ?? draft[theme]) : null
  return Object.keys(patch).length ? patch : null
}
const section = useSettingsSection({
  resource: () => query.data.value,
  key: queryKeys.systemSettings.brandColors(),
  fields: themes,
  refetch: () => client.fetchQuery({ ...brandColorsOptions(), staleTime: 0 }),
  toDraft: (resource) => ({ light: resource.light, dark: resource.dark }),
  toPatch,
  send: updateBrandColors,
  success: () => t('systemSettings.colours.saved'),
  allowed: () => !props.capabilities.demoMode,
  fieldId: (path) => (themes.includes(path as 'light' | 'dark') ? `brand-colour-${path}` : null),
  afterSave: () => invalidateBranding(client),
})
const { editing, draft, saving, status, outdated, problem } = section
const value = computed(() => (editing.value && draft.value ? draft.value : query.data.value))
const valid = computed(() =>
  themes.every((theme) => {
    const colour = draft.value?.[theme]
    return (
      !colour ||
      (normalizeHex(colour) !== null &&
        contrastRatio(colour, reference(theme))! >=
          props.capabilities.brandColors.minimumContrastRatio)
    )
  }),
)
const changes = computed(() =>
  section.changes.value.map((change) => ({
    field: String(change.field),
    label: t(`systemSettings.colours.${change.field}`),
    saved: change.savedValue ? String(change.savedValue) : t('systemSettings.colours.default'),
  })),
)
useLeaveGuard(
  computed(() => section.dirty.value || saving.value),
  'leaveGuard.body',
)
function save(retry = false) {
  if (valid.value && !props.capabilities.demoMode)
    return retry ? section.saveAgain() : section.save()
}
</script>
<template>
  <div class="min-w-0 space-y-4">
    <PageHeader :title="t('systemSettings.colours.title')"
      ><template #actions><HistoryLink target-type="brandColors" /></template
    ></PageHeader>
    <p v-if="query.isPending.value" role="status" aria-busy="true">{{ lt('footer.loading') }}</p>
    <ProblemMessage
      v-else-if="!query.data.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <template v-else>
      <p>{{ t('systemSettings.colours.classic') }}</p>
      <p v-if="capabilities.demoMode" data-demo-mode role="status">
        {{ lt('danger.demo_mode_enabled') }}
      </p>
      <EditableSection
        section-id="brand-colours"
        :title="t('systemSettings.colours.settings')"
        :editable="!capabilities.demoMode"
        :editing="editing"
        :saving="saving"
        :status="status"
        :outdated="changes"
        :version-changed="outdated"
        :can-save="!capabilities.demoMode && valid"
        :save-label="lt('admin.save')"
        @edit="section.open"
        @save="save()"
        @save-again="save(true)"
        @cancel="section.discard"
        @discard="section.discard"
      >
        <dl class="grid gap-3 sm:grid-cols-2">
          <div v-for="theme in themes" :key="theme">
            <dt class="text-sm text-gray-600 dark:text-gray-400">
              {{ t(`systemSettings.colours.${theme}`) }}
            </dt>
            <dd>{{ query.data.value[theme] ?? t('systemSettings.colours.default') }}</dd>
          </div>
        </dl>
        <template #form>
          <ErrorSummary :id="section.form.summaryId" :items="section.form.summary.value" />
          <ProblemMessage
            :problem="
              section.form.formProblem.value ?? (section.form.hasErrors.value ? null : problem)
            "
          />
          <div v-if="draft" class="grid gap-4 lg:grid-cols-2">
            <ColourField
              v-for="theme in themes"
              :id="`brand-colour-${theme}`"
              :key="theme"
              v-model="draft[theme]"
              :label="t(`systemSettings.colours.${theme}`)"
              :surface="reference(theme)"
              :minimum="capabilities.brandColors.minimumContrastRatio"
              :disabled="saving || capabilities.demoMode"
              :errors="section.form.errorsFor(theme)"
              @update:model-value="section.form.clear"
            />
          </div>
        </template>
      </EditableSection>
      <section id="colour-preview" aria-labelledby="colour-preview-title" class="space-y-3">
        <h2 id="colour-preview-title" class="text-lg font-semibold">
          {{ t('systemSettings.colours.preview') }}
        </h2>
        <div class="grid gap-4 lg:grid-cols-2">
          <BrandPreview
            v-for="theme in themes"
            :key="theme"
            :theme="theme"
            :colour="theme === 'dark' ? value?.dark || value?.light || null : value?.light || null"
            :surface="reference(theme)"
            :minimum="capabilities.brandColors.minimumContrastRatio"
            :inherited="theme === 'dark' && !value?.dark && !!value?.light"
          />
        </div>
      </section>
    </template>
  </div>
</template>
