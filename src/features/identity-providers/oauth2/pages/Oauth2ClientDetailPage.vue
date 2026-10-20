<script setup lang="ts">
// The OAuth2 client page (UI 012 US5, FR-060, FR-061, FR-066), mirroring the classic
// `templates/edit/oauth2client.twig`: the heading "OAuth2" with the client ID, and one section with
// the client ID and the scope read-only and the redirect URIs editable in one field (several
// separated by spaces), saved with "Save changes" as a merge patch with the version tag read. No
// stored secret is shown (owner decision), and the actions the classic interface offers only in
// the list (remove, revoke tokens, new secret) stay there. Stored URIs that break the rules are
// marked; an outdated save keeps the input and lists the change; a client that does not exist
// shows the not-found page with a way back to the list.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { lt } from '@/i18n'
import { isApiProblem, problemOf, type Oauth2Client } from '@/api'
import { canAccess } from '@/app/navigation/visibility'
import { useIdentityQuery } from '@/app/session/queries'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import type { SectionChange, SectionStatus } from '@/shared/components/editable-section'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { changedSince, useVersionedSave } from '@/shared/composables/useVersionedSave'
import { useProblemMessages } from '@/i18n/problems'

import {
  oauth2ClientOptions,
  updateOauth2RedirectUris,
  useOauth2Capabilities,
  useOauth2Client,
} from '../api'
import RedirectUriList from '../components/RedirectUriList.vue'
import { useRedirectUriMessages } from '../composables/useRedirectUriMessages'
import { joinRedirectUris, redirectUriProblems, splitRedirectUris } from '../redirect-uris'

const SECTION = 'client'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const identity = useIdentityQuery()
const capabilities = useOauth2Capabilities()
const { problemMessage } = useProblemMessages()
const messages = useRedirectUriMessages()
const fieldId = useId()

const id = computed(() => Number(route.params.oauth2ClientId))
const query = useOauth2Client(id)
const client = computed(() => query.data.value)
const notFound = computed(
  () => !client.value && isApiProblem(query.error.value) && query.error.value.status === 404,
)
const historyAllowed = computed(() => canAccess('auditLog', identity.data.value))

// The section (UI 002 D11): `edit=client` in the address opens it.
const editing = computed(() => route.query.edit === SECTION && !!client.value)
const base = shallowRef<Oauth2Client | null>(null)
const opened = shallowRef<Oauth2Client | null>(null)
const value = ref('')
const status = ref<SectionStatus | null>(null)
const outdatedFields = shallowRef<{ field: 'redirectUris'; savedValue: string[] }[] | null>(null)
const saving = ref(false)

const form = useProblemForm({
  fieldId: (path) => (path === 'redirectUris' || path.startsWith('redirectUris.') ? fieldId : null),
  labelFor: () => lt('edit.redirect_uri'),
})
const versioned = useVersionedSave<Oauth2Client>({
  current: () => base.value,
  refetch: () =>
    queryClient.fetchQuery({ ...oauth2ClientOptions(queryClient, id.value), staleTime: 0 }),
})

function open(from: Oauth2Client) {
  base.value = from
  opened.value = from
  value.value = joinRedirectUris(from.redirectUris)
  outdatedFields.value = null
  form.clear()
  versioned.discard()
}

watch(
  [editing, client],
  ([on, current]) => {
    if (on && current && !opened.value) open(current)
    if (!on) opened.value = null
  },
  { immediate: true },
)

const dirty = computed(
  () =>
    editing.value && !!opened.value && value.value !== joinRedirectUris(opened.value.redirectUris),
)
useLeaveGuard(dirty, { messageKey: 'leaveGuard.body' })

function openSection() {
  status.value = null
  void router.push({ query: { ...route.query, edit: SECTION } })
}

function closeSection() {
  const next = { ...route.query }
  delete next.edit
  const previous = router.options.history.state.back
  const target = router.resolve({ query: next }).fullPath
  if (previous === target) router.back()
  else void router.replace({ query: next })
}

function setStatus(next: SectionStatus) {
  status.value = next
  announce(next.message)
}

async function send(uris: string[]) {
  if (saving.value || !base.value) return
  const from = base.value
  saving.value = true
  form.clear()
  try {
    const result = await versioned.save(uris, (body, ifMatch) =>
      updateOauth2RedirectUris(queryClient, id.value, body, ifMatch),
    )
    if (result.status === 'saved') {
      opened.value = result.result
      base.value = result.result
      value.value = joinRedirectUris(result.result.redirectUris)
      closeSection()
      setStatus({ kind: 'success', message: lt('success.object_modified', String(id.value)) })
      return
    }
    if (result.status === 'outdated') {
      const latest = result.latest ?? from
      outdatedFields.value = changedSince(from, latest, ['redirectUris'] as const, {
        redirectUris: 'value',
      })
      return
    }
    if (result.status === 'cancelled') return
    const failure = problemOf(result.problem)!
    if (failure.status === 422) {
      await form.setProblem(failure)
      return
    }
    if (failure.status === 404) {
      void query.refetch()
      return
    }
    setStatus({ kind: 'error', message: problemMessage(failure) })
  } finally {
    saving.value = false
  }
}

async function save() {
  const uris = splitRedirectUris(value.value)
  const problems = redirectUriProblems(uris, capabilities.data.value?.redirectUrisMaxLength ?? 2000)
  if (problems.length > 0) {
    await form.setClientMessages({ redirectUris: messages(problems) })
    return
  }
  await send(uris)
}

/** "Save again" after a 412: the user's input with the reloaded version tag. */
async function saveAgain() {
  const latest = versioned.latest.value
  if (latest) base.value = latest
  outdatedFields.value = null
  await save()
}

function discard() {
  const latest = versioned.discard() ?? base.value
  if (latest) open(latest)
}

const outdated = computed<SectionChange[] | null>(
  () =>
    outdatedFields.value?.map((item) => ({
      field: item.field,
      label: lt('edit.redirect_uri'),
      saved: joinRedirectUris(item.savedValue) || '—',
    })) ?? null,
)

const term = 'text-sm font-medium text-gray-600 dark:text-gray-400'
const definition = 'min-w-0 text-gray-900 dark:text-white'
</script>

<template>
  <NotFoundPage
    v-if="notFound"
    :back-to="{ name: 'oauth2-clients' }"
    :back-label="t('oauth2.backToList')"
  />
  <div
    v-else-if="!client && query.isPending.value"
    data-page-loading
    role="status"
    aria-busy="true"
    class="mx-auto w-full max-w-3xl"
  >
    <p class="text-gray-600 dark:text-gray-400">{{ lt('datatables.loadingRecords') }}</p>
  </div>
  <section v-else-if="!client" class="mx-auto flex w-full max-w-3xl flex-col gap-3">
    <h1
      tabindex="-1"
      class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
    >
      {{ t('oauth2.title') }}
    </h1>
    <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
  </section>
  <article v-else class="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <RouterLink
      :to="{ name: 'oauth2-clients' }"
      class="inline-flex min-h-11 items-center self-start text-sm font-medium text-accent-text bg-white dark:bg-gray-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <span aria-hidden="true">←&nbsp;</span>{{ lt('edit.previous') }}
    </RouterLink>
    <PageHeader :title="t('oauth2.title')" :description="client.clientId">
      <template #actions>
        <HistoryLink
          target-type="oauth2Client"
          :target-id="String(client.id)"
          :allowed="historyAllowed"
        />
      </template>
    </PageHeader>

    <EditableSection
      section-id="oauth2-client"
      :title="t('oauth2.title')"
      :editable="true"
      :editing="editing"
      :saving="saving"
      :status="status"
      :outdated="outdated"
      :save-label="lt('admin.save')"
      @edit="openSection"
      @cancel="closeSection"
      @save="save"
      @save-again="saveAgain"
      @discard="discard"
    >
      <dl class="grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(10rem,auto)_1fr]">
        <dt :class="term">{{ lt('edit.client_id') }}</dt>
        <dd :class="definition" class="font-mono break-all">{{ client.clientId }}</dd>
        <dt :class="term">{{ lt('edit.scope') }}</dt>
        <dd :class="definition">{{ client.scope ?? '—' }}</dd>
        <dt :class="term">{{ lt('edit.redirect_uri') }}</dt>
        <dd :class="definition"><RedirectUriList :uris="client.redirectUris" marks /></dd>
      </dl>
      <template #form>
        <ErrorSummary :id="form.summaryId" :items="form.summary.value" />
        <ProblemMessage :problem="form.formProblem.value" />
        <dl class="grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(10rem,auto)_1fr]">
          <dt :class="term">{{ lt('edit.client_id') }}</dt>
          <dd :class="definition" class="font-mono break-all">{{ client.clientId }}</dd>
          <dt :class="term">{{ lt('edit.scope') }}</dt>
          <dd :class="definition">{{ client.scope ?? '—' }}</dd>
        </dl>
        <FormField
          :id="fieldId"
          v-slot="field"
          :label="lt('edit.redirect_uri')"
          :errors="form.errorsFor('redirectUris')"
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
      </template>
    </EditableSection>
  </article>
</template>
