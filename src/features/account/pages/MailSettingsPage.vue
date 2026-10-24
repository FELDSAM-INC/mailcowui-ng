<script setup lang="ts">
import SettingsPage from '@/shared/components/SettingsPage.vue'
import { computed } from 'vue'
import { problemOf, type PermissionFlags } from '@/api'
import NoAccessState from '@/app/states/NoAccessState.vue'
import { lt } from '@/i18n'
import MailboxContextHeader from '../components/layout/MailboxContextHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useMailSettings } from '../api/mail-settings'
import GroupwareResets from '../components/groupware/GroupwareResets.vue'
import MailSettingsControls from '../components/mail-settings/MailSettingsControls.vue'
import { useSectionAccess } from '../composables/useSectionAccess'
const access = useSectionAccess(() => 'mailSettings')
const mailbox = access.context.mailbox
const own = computed(() => access.context.kind.value === 'own')
const allowed = (flag: keyof PermissionFlags) =>
  access.canChange.value && (!own.value || access.identity.data.value?.permissions[flag] === true)
// Mailbox administrators edit these fields in the original mailbox tab (D6).
const tagged = computed(() => own.value && allowed('delimiterAction'))
const tls = computed(() => own.value && allowed('tlsPolicy'))
const query = useMailSettings(mailbox, () => tagged.value || tls.value)
const groupwareEnabled = computed(() => access.capabilities.data.value?.groupware?.enabled === true)
const unavailable = computed(
  () =>
    !own.value &&
    !access.capabilities.isPending.value &&
    !access.capabilities.isError.value &&
    !groupwareEnabled.value,
)
</script>
<template>
  <NoAccessState v-if="unavailable" />
  <SettingsPage v-else>
    <template #header>
      <MailboxContextHeader :title="lt('user.mailbox_settings')" />
    </template>
    <template v-if="tagged || tls">
      <p v-if="query.isPending.value" role="status" aria-busy="true">{{ lt('footer.loading') }}</p>
      <MailSettingsControls
        v-else-if="query.data.value"
        :key="mailbox"
        :stored="query.data.value"
        :tagged="tagged"
        :tls="tls"
        :show-warning="own"
        :reload="query.refetch"
      />
      <ProblemMessage
        v-else
        :problem="problemOf(query.error.value)"
        retry
        @retry="query.refetch()"
      />
    </template>
    <ProblemMessage
      v-if="access.capabilities.isError.value"
      :problem="problemOf(access.capabilities.error.value)"
      retry
      @retry="access.capabilities.refetch()"
    />
    <GroupwareResets
      :key="mailbox"
      :mailbox="mailbox"
      :enabled="groupwareEnabled"
      :active-sync="allowed('easReset')"
      :profile="allowed('sogoProfileReset')"
    />
  </SettingsPage>
</template>
