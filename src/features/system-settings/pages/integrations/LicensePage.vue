<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { problemOf, queryKeys, type ApiProblem, type SettingsCapabilities } from '@/api'
import { lt } from '@/i18n'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import CopyButton from '@/shared/components/CopyButton.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { buttonVariants } from '@/shared/ui/button'
import { licenseOptions, verifyLicense } from '../../api/license'
import LicenseResult from '../../components/integrations/LicenseResult.vue'
const props = defineProps<{ capabilities: SettingsCapabilities }>()
const { t } = useI18n(),
  client = useQueryClient()
const blocked = ref(false),
  busy = ref(false),
  guid = ref<HTMLElement>()
const failure = shallowRef<ApiProblem | null>(null)
const available = computed(() => props.capabilities.licenseVerificationEnabled && !blocked.value)
const query = useQuery(computed(() => ({ ...licenseOptions(), enabled: available.value })))
let disposed = false
onScopeDispose(() => {
  disposed = true
})
function checkDisabled(problem: ApiProblem | null) {
  if (!problem?.is('feature-disabled')) return
  blocked.value = true
  void client.invalidateQueries({ queryKey: queryKeys.systemSettings.capabilities() })
}
watch(
  () => query.error.value,
  (error) => checkDisabled(problemOf(error)),
)
async function verify() {
  if (!available.value || busy.value) return
  busy.value = true
  failure.value = null
  try {
    const value = await verifyLicense()
    if (disposed) return
    client.setQueryData(queryKeys.license(), value)
    void client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
    announce(t(`systemSettings.license.results.${value.lastVerification.result}`))
  } catch (error) {
    if (!disposed) {
      failure.value = problemOf(error)
      checkDisabled(failure.value)
    }
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <section class="flex min-w-0 flex-col gap-4">
    <RouterLink
      v-if="available"
      :to="{ name: 'system-settings' }"
      :class="buttonVariants({ variant: 'link', class: 'self-start' })"
      >{{ t('nav.system') }}</RouterLink
    >
    <NotFoundPage
      v-if="!available"
      :back-to="{ name: 'system-settings' }"
      :back-label="t('nav.system')"
    />
    <template v-else>
      <PageHeader :title="lt('admin.guid_and_license')"
        ><template #actions><HistoryLink target-type="license" /></template
      ></PageHeader>
      <p v-if="query.isPending.value" role="status" aria-busy="true">{{ lt('footer.loading') }}</p>
      <ProblemMessage
        v-else-if="!query.data.value"
        :problem="problemOf(query.error.value)"
        retry
        @retry="query.refetch()"
      />
      <section v-else aria-labelledby="license" class="flex min-w-0 flex-col gap-4">
        <h2 id="license" class="text-lg font-semibold">{{ lt('admin.guid') }}</h2>
        <template v-if="query.data.value.guid && query.data.value.guidValid">
          <p ref="guid" data-license-guid class="break-all font-mono">
            {{ query.data.value.guid }}
          </p>
          <CopyButton
            :text="query.data.value.guid"
            :label="t('systemSettings.license.copyGuid')"
            :select-target="guid"
            class="self-start"
          />
        </template>
        <p v-else data-invalid-guid>{{ t('systemSettings.license.guidInvalid') }}</p>
        <LicenseResult :result="query.data.value.lastVerification" />
        <LegacyText k="admin.license_info" as="p" />
        <p>{{ t('systemSettings.license.verifyHelp') }}</p>
        <ProblemMessage :problem="failure" />
        <p v-if="busy" role="status" aria-busy="true">
          {{ t('systemSettings.license.verifying') }}
        </p>
        <button
          data-verify-license
          type="button"
          :class="buttonVariants({ class: 'self-start' })"
          :disabled="busy"
          @click="verify"
        >
          {{ lt('admin.validate_license_now') }}
        </button>
      </section>
    </template>
  </section>
</template>
