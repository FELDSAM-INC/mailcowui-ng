<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'
import {
  queryKeys,
  type LoginPageSettings,
  type LoginPageSettingsPatch,
  type SettingsCapabilities,
} from '@/api'
import { publicConfigQuery } from '@/app/branding/public-config'
import { findEntry } from '@/app/navigation/catalogue'
import { lt } from '@/i18n'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { buttonVariants } from '@/shared/ui/button'
import { invalidateBranding, loginPageOptions, updateLoginPage } from '../../api/branding'
import { useSettingsSection } from '../../composables/useSettingsSection'

const props = defineProps<{
  sectionId: 'sign-in-links' | 'single-sign-on'
  resource: LoginPageSettings
  capabilities: SettingsCapabilities
  editDisabledReason?: string | null
}>()
const emit = defineEmits<{ state: [state: { editing: boolean; dirty: boolean }] }>()
const { t } = useI18n(),
  client = useQueryClient(),
  router = useRouter()
const config = useQuery(publicConfigQuery())
const labels = {
  hideMailboxUserLogin: 'admin.user_quicklink',
  hideDomainAdminLogin: 'admin.domainadmin_quicklink',
  hideAdminLogin: 'admin.admin_quicklink',
  forceSingleSignOn: 'admin.force_sso',
} as const
const fields =
  props.sectionId === 'sign-in-links'
    ? (['hideMailboxUserLogin', 'hideDomainAdminLogin', 'hideAdminLogin'] as const)
    : (['forceSingleSignOn'] as const)
const title = computed(() =>
  props.sectionId === 'sign-in-links' ? lt('admin.login_page') : lt('admin.force_sso'),
)
const section = useSettingsSection({
  resource: () => props.resource,
  key: queryKeys.systemSettings.loginPage(),
  fields,
  refetch: () => client.fetchQuery({ ...loginPageOptions(), staleTime: 0 }),
  toDraft: (resource) => ({ ...resource }),
  toPatch: (draft, base) => {
    const patch: LoginPageSettingsPatch = {}
    for (const field of fields) if (draft[field] !== base[field]) patch[field] = draft[field]
    return Object.keys(patch).length ? patch : null
  },
  send: updateLoginPage,
  success: () => lt('success.custom_login_modified'),
  allowed: () => !props.capabilities.demoMode,
  fieldId: (path) => (path in labels ? `login-page-${path}` : null),
  afterSave: () => invalidateBranding(client),
})
const { editing, draft, saving, status, problem, outdated } = section
watch(
  [editing, section.dirty, saving],
  () => emit('state', { editing: editing.value, dirty: section.dirty.value || saving.value }),
  { immediate: true },
)
const changes = computed(() =>
  section.changes.value.map((change) => ({
    field: String(change.field),
    label: lt(labels[change.field as keyof typeof labels]),
    saved: t(change.savedValue ? 'lists.filters.yes' : 'lists.filters.no'),
  })),
)
const provider = computed(() => {
  const entry = findEntry('identityProviders')
  return entry?.status === 'available' && router.resolve(entry.path).matched.length
    ? entry.path
    : null
})
</script>
<template>
  <div class="min-w-0 space-y-3">
    <EditableSection
      :section-id="sectionId"
      :title="title"
      :editable="!capabilities.demoMode"
      :editing="editing"
      :saving="saving"
      :status="status"
      :outdated="changes"
      :version-changed="outdated"
      :can-save="!capabilities.demoMode"
      :edit-disabled-reason="editDisabledReason"
      :save-label="lt('admin.save')"
      @edit="section.open"
      @save="section.save"
      @save-again="section.saveAgain"
      @cancel="section.discard"
      @discard="section.discard"
    >
      <LegacyText
        :k="sectionId === 'sign-in-links' ? 'admin.quicklink_text' : 'admin.force_sso_text'"
        as="p"
      />
      <dl class="mt-3 space-y-3">
        <div v-for="field in fields" :key="field">
          <dt><LegacyText :k="labels[field]" /></dt>
          <dd>{{ t(resource[field] ? 'lists.filters.yes' : 'lists.filters.no') }}</dd>
        </div>
      </dl>
      <template #form>
        <ErrorSummary :id="section.form.summaryId" :items="section.form.summary.value" />
        <ProblemMessage
          :problem="
            section.form.formProblem.value ?? (section.form.hasErrors.value ? null : problem)
          "
        />
        <LegacyText
          :k="sectionId === 'sign-in-links' ? 'admin.quicklink_text' : 'admin.force_sso_text'"
          as="p"
        />
        <template v-if="draft">
          <label v-for="field in fields" :key="field" class="flex min-h-11 items-center gap-3">
            <input
              :id="`login-page-${field}`"
              v-model="draft[field]"
              type="checkbox"
              class="size-5 shrink-0 accent-brand-600"
              :disabled="saving || capabilities.demoMode"
            /><LegacyText :k="labels[field]" />
          </label>
        </template>
      </template>
    </EditableSection>
    <div
      v-if="
        sectionId === 'single-sign-on' &&
        config.data.value?.externalIdentityProvider.singleSignOnAvailable === false
      "
      data-no-sso
      class="mt-3 space-y-2"
    >
      <p>{{ t('systemSettings.signInPage.noSso') }}</p>
      <RouterLink v-if="provider" :to="provider" :class="buttonVariants({ variant: 'link' })">{{
        t('nav.identityProviders')
      }}</RouterLink>
    </div>
  </div>
</template>
