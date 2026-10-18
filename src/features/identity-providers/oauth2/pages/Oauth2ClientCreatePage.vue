<script setup lang="ts">
// Adding an OAuth2 client (UI 012 US5, FR-058, FR-059), mirroring the classic
// `addOAuth2ClientModal` (`templates/modals/admin.twig`): one "Redirect URI" field, where several
// URIs are separated by spaces as mailcow stores them, and "Add". The request carries no secret but
// its answer does, so it goes through useSecretRequest; the secret is shown once in
// OneTimeSecretDialog, the cache gets the client without it, and closing the dialog replaces this
// page with the list (as the classic modal returns to the list), so Back never brings it back.
// Leaving while the secret is shown asks the dialog's confirmation first.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, useId, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, RouterLink, useRouter } from 'vue-router'

import { lt } from '@/i18n'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import OneTimeSecretDialog from '@/shared/components/OneTimeSecretDialog.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { buttonVariants } from '@/shared/ui/button'

import SectionNav from '../../components/SectionNav.vue'
import { createOauth2Client, rememberCreatedClient, useOauth2Capabilities } from '../api'
import { useRedirectUriMessages } from '../composables/useRedirectUriMessages'
import { redirectUriProblems, splitRedirectUris } from '../redirect-uris'

const { t } = useI18n()
const router = useRouter()
const queryClient = useQueryClient()
const capabilities = useOauth2Capabilities()
const fieldId = useId()

const value = ref('')
const maxLength = computed(() => capabilities.data.value?.redirectUrisMaxLength ?? 2000)
const form = useProblemForm({
  fieldId: (path) => (path === 'redirectUris' || path.startsWith('redirectUris.') ? fieldId : null),
})
const messages = useRedirectUriMessages()

const request = useSecretRequest(createOauth2Client)
const secret = ref<string | null>(null)
const clientId = ref<string | null>(null)
const dialog = useTemplateRef<InstanceType<typeof OneTimeSecretDialog>>('dialog')
let leaving = false

async function submit() {
  if (request.pending.value || secret.value) return
  const uris = splitRedirectUris(value.value)
  const problems = redirectUriProblems(uris, maxLength.value)
  if (problems.length > 0) {
    await form.setClientMessages({ redirectUris: messages(problems) })
    return
  }
  form.clear()
  const result = await request.run(uris)
  if (!result) {
    await form.setProblem(request.problem.value)
    return
  }
  // The secret goes to the dialog only; the cache gets the client without it.
  const created = rememberCreatedClient(queryClient, result)
  request.clear()
  clientId.value = created.clientId
  secret.value = result.clientSecret
  announce(t('oauth2.added'))
}

function onSecretClosed() {
  secret.value = null
  if (leaving) return
  void router.replace({ name: 'oauth2-clients' })
}

onBeforeRouteLeave(async () => {
  if (secret.value === null) return true
  leaving = true
  try {
    return (await dialog.value?.requestClose()) ?? true
  } finally {
    leaving = false
  }
})
</script>

<template>
  <section class="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <SectionNav />
    <PageHeader :title="lt('admin.oauth2_add_client')" />
    <form novalidate class="surface flex flex-col gap-4" @submit.prevent="submit">
      <ErrorSummary :id="form.summaryId" :items="form.summary.value" />
      <ProblemMessage :problem="form.formProblem.value" />
      <p v-if="clientId" role="status" class="font-medium text-gray-900 dark:text-white">
        {{ t('oauth2.added') }}
      </p>
      <FormField
        :id="fieldId"
        v-slot="field"
        :label="lt('admin.oauth2_redirect_uri')"
        :errors="form.errorsFor('redirectUris')"
        required
      >
        <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
        <input
          v-bind="field"
          v-model="value"
          type="text"
          inputmode="url"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          class="form-control"
        />
      </FormField>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <RouterLink
          :to="{ name: 'oauth2-clients' }"
          :class="buttonVariants({ variant: 'outline' })"
        >
          {{ lt('footer.cancel') }}
        </RouterLink>
        <button
          type="submit"
          :class="buttonVariants({})"
          :disabled="request.pending.value"
          :aria-busy="request.pending.value ? 'true' : 'false'"
        >
          {{ lt('admin.add') }}
        </button>
      </div>
    </form>
    <OneTimeSecretDialog
      ref="dialog"
      :secret="secret"
      :title="lt('admin.oauth2_add_client')"
      :description="clientId ? `${lt('admin.oauth2_client_id')}: ${clientId}` : undefined"
      @close="onSecretClosed"
    />
  </section>
</template>
