<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { problemOf, type AppleProfileRequest } from '@/api'
import { lt } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { safeHref } from '@/shared/security/safe-url'
import { useClientConfiguration } from '../api/client-setup'
import { useOwnMailboxOverview } from '../api/overview'
import { useOwnSecondFactors } from '../api/second-factors'
import AppleProfileDownloads from '../components/mail-apps/AppleProfileDownloads.vue'
import ClientSetupGuide from '../components/mail-apps/ClientSetupGuide.vue'
import { useSectionAccess } from '../composables/useSectionAccess'
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const variant: AppleProfileRequest['variant'] | undefined =
  route.query.variant === 'email' || route.query.variant === 'emailAndDav'
    ? route.query.variant
    : undefined
const appPassword = route.query.appPassword === '1'
if ('variant' in route.query || 'appPassword' in route.query) {
  const query = { ...route.query }
  delete query.variant
  delete query.appPassword
  void router.replace({ query, hash: route.hash })
}
const access = useSectionAccess(() => 'mailApps')
const config = useClientConfiguration()
const overview = useOwnMailboxOverview()
const factors = useOwnSecondFactors()
const canAppPasswords = computed(() => !!access.identity.data.value?.permissions.appPasswds)
const secondFactor = computed(
  () => factors.data.value?.some((factor) => factor.active && factor.usable) ?? false,
)
const directOff = computed(() =>
  overview.data.value
    ? Object.values(overview.data.value.protocolAccess).some((enabled) => !enabled)
    : false,
)
const guideLink = computed(() => safeHref(config.data.value?.documentationUrl))
</script>
<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="t('account.sections.mailApps')" />
    <p v-if="config.isPending.value" role="status" aria-busy="true">{{ lt('user.loading') }}</p>
    <ProblemMessage
      v-else-if="config.isError.value"
      :problem="problemOf(config.error.value)"
      retry
      @retry="config.refetch()"
    />
    <template v-else-if="config.data.value">
      <div v-if="secondFactor || directOff" class="surface flex flex-col gap-3">
        <LegacyText v-if="secondFactor" k="user.tfa_info" as="p" />
        <LegacyText v-if="directOff" k="user.direct_protocol_access" as="p" />
        <RouterLink
          v-if="canAppPasswords"
          :to="{ name: 'account-app-passwords' }"
          class="inline-flex min-h-11 items-center underline"
          >{{ lt('user.app_passwds') }}</RouterLink
        >
      </div>
      <AppleProfileDownloads
        :mailbox="access.context.mailbox.value"
        :groupware="!!access.capabilities.data.value?.groupware?.enabled"
        :app-passwords="canAppPasswords"
        :selected-variant="variant"
        :selected-app-password="appPassword"
      />
      <ClientSetupGuide
        :configuration="config.data.value"
        :protocol-access="overview.data.value?.protocolAccess"
      />
      <a
        v-if="guideLink"
        :href="guideLink"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex min-h-11 items-center underline"
        >{{ lt('user.client_configuration') }}</a
      >
    </template>
  </section>
</template>
