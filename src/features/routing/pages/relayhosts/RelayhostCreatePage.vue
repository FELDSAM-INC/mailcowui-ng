<script setup lang="ts">
// Adding a relayhost (UI 009 US1; the add form of `templates/admin/tab-routing.twig`): host with
// legacy's placeholder, username and password, and legacy's plain-text hint. The request carries
// a password, so it is a direct client call that never reaches a query cache (research R7); the
// typed password is cleared after every attempt. A refused host shows legacy's
// `danger.invalid_host`; after the creation the list opens and `success.relayhost_added` is
// announced.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'

import { afterRelayhostWrite, createRelayhost } from '../../api/relayhosts'
import { useRoutingCapabilities } from '../../capabilities'
import CredentialFields from '../../components/common/CredentialFields.vue'
import EntryCreateFrame from '../../components/common/EntryCreateFrame.vue'
import { credentialCreate, credentialIntent } from '../../logic/credentials'

const ID = 'relayhost-add'
const { t } = useI18n()
const router = useRouter()
const client = useQueryClient()
const capabilities = useRoutingCapabilities()
const limits = computed(() => capabilities.administration.value?.maxLengths ?? null)

const host = ref('')
const credentials = ref(credentialIntent(null))
const entered = computed(
  () => host.value !== '' || credentials.value.username !== '' || credentials.value.password !== '',
)
const guard = useLeaveGuard(entered, { messageKey: 'leaveGuard.body' })

const FIELDS = new Set(['host', 'username', 'password'])
const form = useProblemForm({
  fieldId: (path) => (FIELDS.has(path) ? `${ID}-${path}` : null),
  formKey: 'routing.relayhosts.form',
  valueAt: (path) => (path === 'host' ? host.value.trim() : undefined),
})
const request = useSecretRequest(createRelayhost)

async function submit() {
  if (request.pending.value) return
  if (host.value.trim() === '') {
    await form.setClientErrors({ host: ['validation.required'] })
    return
  }
  form.clear()
  const created = await request.run({
    host: host.value.trim(),
    ...credentialCreate(credentials.value),
  })
  credentials.value = { ...credentials.value, password: '' }
  if (!created) {
    await form.setProblem(request.problem.value)
    return
  }
  await afterRelayhostWrite(client, created)
  guard.disarm()
  announce(lt('success.relayhost_added', created.host))
  await router.replace({ name: 'routing-relayhosts' })
}
</script>

<template>
  <EntryCreateFrame
    :title="lt('admin.add_relayhost')"
    hint="admin.add_relayhost_hint"
    list-route="routing-relayhosts"
    :summary-id="form.summaryId"
    :summary="form.summary.value"
    :problem="form.formProblem.value"
    :saving="request.pending.value"
    @submit="submit"
  >
    <FormField :id="`${ID}-host`" :label="lt('admin.host')" :errors="form.errorsFor('host')">
      <template #default="control">
        <input
          v-bind="control"
          v-model="host"
          type="text"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          :maxlength="limits?.host"
          :placeholder="t('routing.relayhosts.hostPlaceholder')"
          class="form-control"
        />
      </template>
    </FormField>
    <CredentialFields
      v-model="credentials"
      :id-prefix="ID"
      mode="create"
      :errors-for="form.errorsFor"
      :max-lengths="limits"
    />
  </EntryCreateFrame>
</template>
