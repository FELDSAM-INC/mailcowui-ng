<script setup lang="ts">
// My account › Change password (UI 005 US1): the form, or the external notice when the password
// lives in an identity provider. Mailbox users see legacy's app-password hint with the overview's
// count of active app passwords.
import { computed } from 'vue'

import { lt } from '@/i18n'
import SettingsPage from '@/shared/components/SettingsPage.vue'

import { useOwnMailboxOverview } from '../api/overview'
import ExternalPasswordNotice from '../components/password/ExternalPasswordNotice.vue'
import OwnPasswordForm from '../components/password/OwnPasswordForm.vue'
import { useSectionAccess } from '../composables/useSectionAccess'

const access = useSectionAccess(() => 'password')
const identity = computed(() => access.identity.data.value)
const isMailbox = computed(() => identity.value?.role === 'mailboxUser')
const overview = useOwnMailboxOverview(isMailbox)
</script>

<template>
  <SettingsPage :title="lt('user.change_password')">
    <ExternalPasswordNotice v-if="access.own.value === 'replaced'" />
    <OwnPasswordForm
      v-else-if="identity"
      :identity="identity"
      :active-app-passwords="overview.data.value?.activeAppPasswords ?? null"
    />
  </SettingsPage>
</template>
