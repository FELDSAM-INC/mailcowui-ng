<script setup lang="ts">
// Creating an API key (FR-065, FR-066, FR-080, data-model §7): a form in sections (name, owner,
// access, expiry, allowed networks) with read-only access, no expiry and the signed-in
// administrator preselected. The request goes through useSecretRequest; the one-time secret is
// shown in OneTimeSecretDialog only, and the new key reaches the cache without it. Closing the
// dialog replaces this page with the key's detail, so Back and Forward never bring the secret
// back. Leaving while the secret is shown asks the dialog's confirmation first.
import { useQueryClient } from '@tanstack/vue-query'
import { ref, useId, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, RouterLink, useRouter } from 'vue-router'

import type { ApiKeyAccessLevel } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { lt, text } from '@/i18n'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import OneTimeSecretDialog from '@/shared/components/OneTimeSecretDialog.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { buttonVariants } from '@/shared/ui/button'
import { API_KEY_NAME_MAX_LENGTH } from '@/shared/validation/limits'

import { createApiKey, rememberCreatedKey } from '../api'
import ExpiryField, { type ExpiryValue } from '../components/ExpiryField.vue'
import NetworkListField from '../components/NetworkListField.vue'
import OwnerPicker from '../components/OwnerPicker.vue'
import { resolveExpiry } from '../expiry'
import { validateNetworks } from '../networks'

const { t } = useI18n()
const router = useRouter()
const queryClient = useQueryClient()
const identity = useIdentityQuery()

const ids = {
  name: useId(),
  owner: useId(),
  access: useId(),
  expiry: useId(),
  expiryCustom: useId(),
  networks: useId(),
  headings: {
    name: useId(),
    owner: useId(),
    access: useId(),
    expiry: useId(),
    networks: useId(),
  },
}
const ACCESS_LEVELS: ApiKeyAccessLevel[] = ['readOnly', 'readWrite']

const name = ref('')
const owner = ref<string | null>(null)
const accessLevel = ref<ApiKeyAccessLevel>('readOnly')
const expiry = ref<ExpiryValue>({ choice: 'never', custom: '' })
const networks = ref<string[]>([])

// The owner picker starts with the signed-in administrator (US7-AS10).
watch(
  () => identity.data.value?.username,
  (username) => {
    if (username && owner.value === null) owner.value = username
  },
  { immediate: true },
)

const form = useProblemForm({
  fieldId: (path) => {
    if (path === 'name') return ids.name
    if (path === 'ownerUsername') return ids.owner
    if (path === 'accessLevel') return `${ids.access}-readOnly`
    if (path === 'expiresAt') {
      return expiry.value.choice === 'custom' ? ids.expiryCustom : ids.expiry
    }
    if (path === 'allowedNetworks') return `${ids.networks}-add`
    const entry = /^allowedNetworks\.(\d+)$/.exec(path)
    return entry ? `${ids.networks}-${entry[1]}` : null
  },
})
const request = useSecretRequest(createApiKey)

const secret = ref<string | null>(null)
const created = ref<{ id: string; name: string } | null>(null)
const dialog = useTemplateRef<InstanceType<typeof OneTimeSecretDialog>>('dialog')
let leaving = false

async function submit() {
  if (request.pending.value || secret.value) return
  const errors: Record<string, string[]> = {}
  const trimmed = name.value.trim()
  if (!trimmed) errors.name = ['validation.required']
  if (!owner.value) errors.ownerUsername = ['validation.required']
  const expiresAt = resolveExpiry(expiry.value.choice, expiry.value.custom)
  if (!expiresAt.ok) errors.expiresAt = [expiresAt.error]
  const checked = validateNetworks(networks.value)
  networks.value = checked.networks
  Object.assign(errors, checked.errors)
  if (Object.keys(errors).length > 0) {
    await form.setClientErrors(errors)
    return
  }
  form.clear()
  const result = await request.run({
    name: trimmed,
    ownerUsername: owner.value!,
    accessLevel: accessLevel.value,
    expiresAt: expiresAt.ok ? expiresAt.value : null,
    allowedNetworks: checked.networks,
  })
  if (!result) {
    await form.setProblem(request.problem.value)
    return
  }
  // The secret goes to the dialog only; the cache gets the key without it.
  const key = rememberCreatedKey(queryClient, result)
  request.clear()
  created.value = { id: key.id, name: key.name }
  secret.value = result.secret
  announce(t('apiKeys.create.created'))
}

function onSecretClosed() {
  secret.value = null
  if (leaving || !created.value) return
  void router.replace({ name: 'api-key-detail', params: { apiKeyId: created.value.id } })
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

const sectionHeading = 'text-lg font-semibold text-gray-900 dark:text-white'
const hint = 'text-sm text-gray-600 dark:text-gray-400'
</script>

<template>
  <section class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <PageHeader :title="t('apiKeys.create.title')" :description="t('apiKeys.create.intro')" />
    <form novalidate class="flex flex-col gap-6" @submit.prevent="submit">
      <ErrorSummary :id="form.summaryId" :items="form.summary.value" />
      <ProblemMessage :problem="form.formProblem.value" />

      <section class="surface flex flex-col gap-3" :aria-labelledby="ids.headings.name">
        <h2 :id="ids.headings.name" :class="sectionHeading">{{ t('apiKeys.form.name') }}</h2>
        <FormField
          :id="ids.name"
          v-slot="field"
          :label="t('apiKeys.form.name')"
          :description="t('apiKeys.form.nameHint')"
          :errors="form.errorsFor('name')"
          required
        >
          <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- labelled by FormField (for/id) -->
          <input
            v-bind="field"
            v-model="name"
            type="text"
            autocomplete="off"
            :maxlength="API_KEY_NAME_MAX_LENGTH"
            class="form-control"
          />
        </FormField>
      </section>

      <section class="surface flex flex-col gap-3" :aria-labelledby="ids.headings.owner">
        <h2 :id="ids.headings.owner" :class="sectionHeading">{{ lt('mailbox.owner') }}</h2>
        <OwnerPicker
          :id="ids.owner"
          v-model="owner"
          mode="pick"
          :label="lt('mailbox.owner')"
          :description="t('apiKeys.form.ownerHint')"
          :errors="form.errorsFor('ownerUsername')"
          required
        />
      </section>

      <section class="surface flex flex-col gap-3" :aria-labelledby="ids.headings.access">
        <h2 :id="ids.headings.access" :class="sectionHeading">{{ t('apiKeys.form.access') }}</h2>
        <div role="radiogroup" :aria-labelledby="ids.headings.access" class="flex flex-col gap-2">
          <label
            v-for="level in ACCESS_LEVELS"
            :key="level"
            class="flex min-h-11 items-start gap-3 py-1 text-gray-800 dark:text-gray-200"
          >
            <input
              :id="`${ids.access}-${level}`"
              v-model="accessLevel"
              type="radio"
              :value="level"
              :aria-describedby="`${ids.access}-${level}-hint`"
              class="mt-0.5 size-5 shrink-0 accent-brand-500"
            />
            <span class="flex flex-col">
              <span class="font-medium">{{ text(`enums.apiKeyAccessLevel.${level}`) }}</span>
              <span :id="`${ids.access}-${level}-hint`" :class="hint">
                {{ t(`apiKeys.form.accessHint.${level}`) }}
              </span>
            </span>
          </label>
        </div>
      </section>

      <section class="surface flex flex-col gap-3" :aria-labelledby="ids.headings.expiry">
        <h2 :id="ids.headings.expiry" :class="sectionHeading">{{ t('apiKeys.form.expiry') }}</h2>
        <ExpiryField
          v-model="expiry"
          :group-id="ids.expiry"
          :custom-id="ids.expiryCustom"
          :labelled-by="ids.headings.expiry"
          :errors="form.errorsFor('expiresAt')"
        />
      </section>

      <section class="surface flex flex-col gap-3" :aria-labelledby="ids.headings.networks">
        <h2 :id="ids.headings.networks" :class="sectionHeading">
          {{ lt('admin.api_allow_from') }}
        </h2>
        <p :class="hint">{{ t('apiKeys.form.networksHint') }}</p>
        <NetworkListField
          v-model="networks"
          :id-prefix="ids.networks"
          :errors-for="form.errorsFor"
        />
      </section>

      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <RouterLink :to="{ name: 'api-keys' }" :class="buttonVariants({ variant: 'outline' })">
          {{ lt('footer.cancel') }}
        </RouterLink>
        <button
          type="submit"
          :class="buttonVariants({})"
          :disabled="request.pending.value"
          :aria-busy="request.pending.value ? 'true' : 'false'"
        >
          {{ request.pending.value ? lt('footer.loading') : t('apiKeys.create.submit') }}
        </button>
      </div>
    </form>

    <OneTimeSecretDialog
      ref="dialog"
      :secret="secret"
      :title="t('apiKeys.secret.title')"
      :description="created ? t('apiKeys.secret.description', { name: created.name }) : undefined"
      @close="onSecretClosed"
    />
  </section>
</template>
