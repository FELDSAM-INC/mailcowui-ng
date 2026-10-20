<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import { problemOf, queryKeys, type SettingsCapabilities } from '@/api'
import { lt } from '@/i18n'
import { invalidatePublicAddresses } from '@/features/operations'
import EditableSection from '@/shared/components/EditableSection.vue'
import FormField from '@/shared/components/FormField.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { buttonVariants } from '@/shared/ui/button'

import { ipCheckOptions, updateIpCheck, useIpCheck } from '../../api/server'
import { useSettingsSection } from '../../composables/useSettingsSection'

const props = defineProps<{ capabilities: SettingsCapabilities }>()
const { t } = useI18n()
const router = useRouter()
const client = useQueryClient()
const query = useIpCheck()
const section = useSettingsSection({
  resource: () => query.data.value,
  key: queryKeys.systemSettings.ipCheck(),
  fields: ['enabled'],
  refetch: () => client.fetchQuery({ ...ipCheckOptions(), staleTime: 0 }),
  toDraft: (resource) => ({ enabled: resource.enabled }),
  toPatch: (draft, base) => (draft.enabled === base.enabled ? null : { enabled: draft.enabled }),
  send: updateIpCheck,
  allowed: () => !props.capabilities.demoMode,
  fieldId: (path) => (path === 'enabled' ? 'ip-check-enabled' : null),
  success: () => lt('success.ip_check_opt_in_modified'),
  afterSave: () => invalidatePublicAddresses(client),
})
const { editing, draft, dirty, saving, outdated, status, problem } = section
const changes = computed(() =>
  section.changes.value.map((change) => ({
    field: String(change.field),
    label: lt('admin.ip_check'),
    saved: t(change.savedValue ? 'lists.filters.yes' : 'lists.filters.no'),
  })),
)
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
    >
      {{ t('nav.system') }}
    </RouterLink>
    <PageHeader :title="lt('admin.ip_check')">
      <template #actions><HistoryLink target-type="ipCheck" /></template>
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
        section-id="opt-in"
        :title="lt('admin.ip_check')"
        :editable="!capabilities.demoMode"
        :editing="editing"
        :saving="saving"
        :status="status"
        :outdated="changes"
        :version-changed="outdated"
        :can-save="!capabilities.demoMode"
        :save-label="lt('admin.save')"
        @edit="section.open"
        @save="section.save"
        @save-again="section.saveAgain"
        @discard="section.discard"
        @cancel="section.discard"
      >
        <div class="flex flex-col gap-3">
          <LegacyText k="admin.ip_check_opt_in" as="p" />
          <p data-ip-check-value>
            {{ t(query.data.value.enabled ? 'lists.filters.yes' : 'lists.filters.no') }}
          </p>
        </div>
        <template #form>
          <div v-if="draft" data-ip-check-form class="flex flex-col gap-3">
            <ProblemMessage :problem="problem" />
            <FormField
              id="ip-check-enabled"
              :label="lt('admin.ip_check_opt_in')"
              :errors="section.form.errorsFor('enabled')"
            >
              <template #label><LegacyText k="admin.ip_check_opt_in" /></template>
              <template #default="control">
                <input
                  v-bind="control"
                  v-model="draft.enabled"
                  type="checkbox"
                  :disabled="saving || capabilities.demoMode"
                  class="size-11 shrink-0 accent-accent"
                />
              </template>
            </FormField>
          </div>
        </template>
      </EditableSection>
      <RouterLink
        v-if="router.hasRoute('operations-dashboard')"
        :to="{ name: 'operations-dashboard' }"
        :class="buttonVariants({ variant: 'link', class: 'self-start' })"
      >
        {{ lt('debug.system_containers') }}
      </RouterLink>
    </template>
  </section>
</template>
