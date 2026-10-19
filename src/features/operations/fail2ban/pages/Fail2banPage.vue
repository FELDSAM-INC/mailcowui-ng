<script setup lang="ts">
// The ban service (UI 011 US5, FR-063 to FR-074), mirroring legacy's Fail2ban panel of System ›
// Configuration (`templates/admin/tab-config-f2b.twig`, plan decisions 13 and 14) on one page with
// one address: the parameters form (one section with its own Edit and Save, "Restart netfilter"
// beside it), the regex filters, and the ban list. A notice says when the ban service is not
// running. Leaving with unsaved changes asks first.
import { useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { problemOf } from '@/api'
import { lt } from '@/i18n'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { WarningIcon } from '@/shared/icons'

import { useMonitoringCapabilities } from '../../capabilities'
import { rulesOptions, settingsOptions } from '../api'
import BanListSection from '../components/BanListSection.vue'
import ParametersSection from '../components/ParametersSection.vue'
import RulesSection from '../components/RulesSection.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const capabilities = useMonitoringCapabilities()
const settings = useQuery(settingsOptions())
const rules = useQuery(rulesOptions())

// The open section lives in the address (`edit=parameters`, UI 002's sections).
const editing = computed(() => route.query.edit === 'parameters')
function setEditing(open: boolean) {
  const query = { ...route.query }
  if (open) query.edit = 'parameters'
  else delete query.edit
  void router.replace({ query })
}

const parametersDirty = ref(false)
const rulesDirty = ref(false)
useLeaveGuard(
  computed(() => parametersDirty.value || rulesDirty.value),
  { messageKey: 'leaveGuard.body' },
)

const notRunning = computed(
  () =>
    settings.data.value?.banServiceRunning === false ||
    rules.data.value?.banServiceRunning === false,
)
</script>

<template>
  <section class="mx-auto flex w-full max-w-5xl flex-col gap-4">
    <PageHeader :title="lt('admin.f2b_parameters')" />

    <p
      v-if="notRunning"
      data-ban-service-stopped
      role="status"
      class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      <WarningIcon class="mt-0.5 size-4 shrink-0" />
      <span>{{ t('operations.fail2ban.notRunning') }}</span>
    </p>

    <p v-if="settings.isPending.value" role="status" aria-busy="true">
      {{ lt('datatables.loadingRecords') }}
    </p>
    <ProblemMessage
      v-else-if="!settings.data.value"
      :problem="problemOf(settings.error.value)"
      retry
      @retry="settings.refetch()"
    />
    <template v-else>
      <ParametersSection
        :settings="settings.data.value"
        :capabilities="capabilities.capabilities.value"
        :editing="editing"
        @edit="setEditing(true)"
        @close="setEditing(false)"
        @dirty="(dirty) => (parametersDirty = dirty)"
      >
        <!-- T114: "Restart netfilter" (`header.restart_netfilter`) for the container whose role is
             `banService` goes here, beside the form's actions, as legacy places it. -->
        <template #restart />
      </ParametersSection>

      <RulesSection
        v-if="rules.data.value"
        :rules="rules.data.value"
        :capabilities="capabilities.capabilities.value"
        @dirty="(dirty) => (rulesDirty = dirty)"
      />
      <ProblemMessage
        v-else-if="rules.isError.value"
        :problem="problemOf(rules.error.value)"
        retry
        @retry="rules.refetch()"
      />

      <BanListSection
        :settings="settings.data.value"
        :capabilities="capabilities.capabilities.value"
      />
    </template>
  </section>
</template>
