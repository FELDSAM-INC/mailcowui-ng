<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { problemOf, queryKeys, type SettingsCapabilities } from '@/api'
import { identityQuery } from '@/app/session/queries'
import { lt } from '@/i18n'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SettingsLoading from '../../components/common/SettingsLoading.vue'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { APP_LINK_URL_MAX_LENGTH } from '@/shared/validation/limits'
import { appLinksOptions, updateAppLinks, invalidateBranding } from '../../api/branding'
import AppLinkList from '../../components/branding/AppLinkList.vue'
import BuiltInAppLinks from '../../components/branding/BuiltInAppLinks.vue'
import { useSettingsSection } from '../../composables/useSettingsSection'
import { appLinkErrors, type AppLinkError } from '../../lib/app-link-url'
const props = defineProps<{ capabilities: SettingsCapabilities }>()
const { t } = useI18n(),
  client = useQueryClient(),
  query = useQuery(appLinksOptions()),
  identity = useQuery(identityQuery())
const username = computed(() => identity.data.value?.username ?? '')
const section = useSettingsSection({
  resource: () => query.data.value,
  key: queryKeys.systemSettings.appLinks(),
  fields: ['links'],
  refetch: () => client.fetchQuery({ ...appLinksOptions(), staleTime: 0 }),
  toDraft: (resource) => ({ links: resource.links.map((link) => ({ ...link })) }),
  toPatch: (draft, base) =>
    JSON.stringify(draft.links) === JSON.stringify(base.links)
      ? null
      : { links: draft.links.map((link) => ({ ...link, signedInUrl: link.signedInUrl || null })) },
  send: updateAppLinks,
  success: () => lt('success.app_links'),
  allowed: () => !props.capabilities.demoMode,
  fieldId: (path) =>
    /^links\.\d+\.(name|url|signedInUrl|showOnLoginPage)$/.test(path)
      ? `app-link-${path.slice(6).replaceAll('.', '-')}`
      : null,
  afterSave: () => invalidateBranding(client),
})
const { editing, draft, dirty, saving, status, problem, outdated } = section
const rejectedPaste = ref<string | null>(null)
const changes = computed(() =>
  section.changes.value.map((change) => ({
    field: String(change.field),
    label: lt('admin.app_links'),
    saved: Array.isArray(change.savedValue)
      ? change.savedValue.map((link) => link.name).join(', ')
      : '',
  })),
)
useLeaveGuard(
  computed(() => dirty.value || saving.value),
  'leaveGuard.body',
)
function errorText(rule: AppLinkError, path: string) {
  if (rule === 'tooLong')
    return t('validation.tooLong', { max: path.endsWith('.name') ? 255 : APP_LINK_URL_MAX_LENGTH })
  if (rule === 'required') return t('validation.required')
  return t(`systemSettings.appLinks.${rule === 'limit' ? 'limitError' : rule}`)
}
async function invalidPaste(path: string) {
  rejectedPaste.value = path
  await section.form.setClientMessages({ [path]: [t('systemSettings.appLinks.singleLine')] })
}
function input() {
  if (rejectedPaste.value) {
    rejectedPaste.value = null
    section.form.clear()
  }
}
function open() {
  rejectedPaste.value = null
  section.open()
}
async function save(retry = false) {
  if (!draft.value || saving.value || props.capabilities.demoMode || rejectedPaste.value) return
  const errors = appLinkErrors(draft.value.links)
  if (Object.keys(errors).length) {
    await section.form.setClientMessages(
      Object.fromEntries(
        Object.entries(errors).map(([path, rule]) => [path, [errorText(rule, path)]]),
      ),
    )
    return
  }
  if (retry) await section.saveAgain()
  else await section.save()
}
</script>
<template>
  <div class="min-w-0 space-y-4">
    <PageHeader :title="lt('admin.app_links')"
      ><template #actions><HistoryLink target-type="appLinks" /></template
    ></PageHeader>
    <SettingsLoading v-if="query.isPending.value" />
    <ProblemMessage
      v-else-if="!query.data.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <template v-else>
      <p v-if="capabilities.demoMode" data-demo-mode role="status">
        {{ lt('danger.demo_mode_enabled') }}
      </p>
      <LegacyText k="admin.merged_vars_hint" as="p" />
      <p>{{ t('systemSettings.appLinks.urlHelp') }}</p>
      <p>{{ t('systemSettings.appLinks.relativeHelp') }}</p>
      <EditableSection
        section-id="app-links"
        :title="lt('admin.app_links')"
        :editable="!capabilities.demoMode"
        :editing="editing"
        :saving="saving"
        :status="status"
        :outdated="changes"
        :version-changed="outdated"
        :can-save="!capabilities.demoMode"
        :save-label="lt('admin.save')"
        @edit="open"
        @save="save()"
        @save-again="save(true)"
        @cancel="section.discard"
        @discard="section.discard"
      >
        <AppLinkList :model-value="query.data.value.links" :username="username" />
        <template #form
          ><template v-if="draft">
            <ErrorSummary :id="section.form.summaryId" :items="section.form.summary.value" />
            <ProblemMessage
              :problem="
                section.form.formProblem.value ?? (section.form.hasErrors.value ? null : problem)
              "
            />
            <AppLinkList
              v-model="draft.links"
              :username="username"
              editable
              :disabled="saving || capabilities.demoMode"
              :errors-for="section.form.errorsFor"
              @invalid-paste="invalidPaste"
              @input="input"
            /> </template
        ></template>
      </EditableSection>
      <BuiltInAppLinks :links="query.data.value.builtInLinks" :username="username" />
    </template>
  </div>
</template>
