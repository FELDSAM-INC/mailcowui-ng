<script setup lang="ts">
import SettingsPage from '@/shared/components/SettingsPage.vue'
import { ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router'
import type { AppPassword, AppPasswordResult } from '@/api'
import NoAccessState from '@/app/states/NoAccessState.vue'
import { lt } from '@/i18n'
import MailboxContextHeader from '../components/layout/MailboxContextHeader.vue'
import OneTimeSecretDialog from '@/shared/components/OneTimeSecretDialog.vue'
import AppPasswordForm from '../components/app-passwords/AppPasswordForm.vue'
import { useAppPasswordContext } from '../composables/useAppPasswordContext'
const { access, mailbox, location } = useAppPasswordContext()
const router = useRouter()
const secret = ref<string | null>(null)
const createdId = ref<number | null>(null)
const dialog = ref<{ requestClose(): Promise<boolean> } | null>(null)
let leaving = false
watch(mailbox, () => {
  createdId.value = null
  secret.value = null
  leaving = false
})
function saved(value: AppPassword | AppPasswordResult) {
  createdId.value = value.id
  secret.value = 'generatedPassword' in value ? value.generatedPassword : null
  if (!secret.value) void close()
}
async function close() {
  secret.value = null
  if (createdId.value !== null && !leaving)
    await router.replace(location('detail', createdId.value))
}
async function guard() {
  leaving = true
  const allowed = (await dialog.value?.requestClose()) ?? true
  if (!allowed) leaving = false
  return allowed
}
onBeforeRouteLeave(guard)
onBeforeRouteUpdate(guard)
</script>
<template>
  <SettingsPage>
    <template #header>
      <MailboxContextHeader :title="lt('add.app_password')" />
    </template>
    <NoAccessState v-if="!access.canChange.value" />
    <AppPasswordForm
      v-else
      :key="mailbox"
      :mailbox="mailbox"
      :can-change="access.canChange.value"
      @saved="saved"
    />
    <OneTimeSecretDialog
      ref="dialog"
      :secret="secret"
      :title="lt('edit.app_passwd')"
      :username="mailbox"
      grouped
      @close="close"
    />
  </SettingsPage>
</template>
