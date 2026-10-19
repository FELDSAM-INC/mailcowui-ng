<script setup lang="ts">
// The quarantine settings of administrators (UI 006 US7, FR-059 to FR-064, legacy form map screen
// 8): System › Configuration › Quarantine of the classic interface, as one section (D11). Legacy's
// `quarantine.disabled_by_config` is shown while the quarantine is inactive, and nothing when it is
// active (D12). Every limit comes from the quarantine capabilities.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { problemOf } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { lt } from '@/i18n'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { InfoIcon } from '@/shared/icons'

import { useQuarantineCapabilities } from '../capabilities'
import QuarantineSectionNav from '../components/QuarantineSectionNav.vue'
import QuarantineSettingsSection from '../components/settings/QuarantineSettingsSection.vue'
import { canSeeHistory } from '../permissions'
import { useQuarantineSettings } from '../settings-api'

const { t } = useI18n()
const identity = useIdentityQuery()
const settingsQuery = useQuarantineSettings()
const capabilities = useQuarantineCapabilities()
const settings = computed(() => settingsQuery.data.value ?? null)
const limits = computed(() => capabilities.data.value?.settings ?? null)
const loading = computed(
  () => (settingsQuery.isPending.value || capabilities.isPending.value) && !failure.value,
)
const failure = computed(
  () =>
    (!settings.value && problemOf(settingsQuery.error.value)) ||
    (!limits.value && problemOf(capabilities.error.value)) ||
    null,
)
const dirty = ref(false)

function retry() {
  if (settingsQuery.isError.value) void settingsQuery.refetch()
  if (capabilities.isError.value) void capabilities.refetch()
}

useLeaveGuard(dirty, { messageKey: 'leaveGuard.body' })
</script>

<template>
  <section class="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-4">
    <QuarantineSectionNav />
    <PageHeader :title="lt('admin.quarantine')" />

    <p v-if="loading" role="status" class="text-sm text-gray-700 dark:text-gray-300">
      {{ lt('datatables.loadingRecords') }}
    </p>
    <div v-else-if="failure" class="flex flex-col gap-2">
      <p class="text-gray-900 dark:text-white">{{ t('states.detail.error') }}</p>
      <ProblemMessage :problem="failure" retry @retry="retry" />
    </div>
    <template v-else-if="settings && limits">
      <div
        v-if="!settings.active"
        data-quarantine-inactive
        role="status"
        class="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100"
      >
        <InfoIcon class="mt-0.5 size-5 shrink-0" />
        <p class="min-w-0 break-words">{{ lt('quarantine.disabled_by_config') }}</p>
      </div>
      <QuarantineSettingsSection
        :settings="settings"
        :limits="limits"
        :history="canSeeHistory(identity.data.value)"
        @dirty="dirty = $event"
      />
    </template>
  </section>
</template>
