<script setup lang="ts">
// The identity provider screen (UI 012 US1, US4), the classic System › Configuration tab
// `templates/admin/tab-config-identity-provider.twig` as one section (plan "Legacy form map"):
// legacy's title and description; with nothing stored, legacy's form ready to fill in; with a
// stored configuration, its values read-only in one section whose Edit opens the same form (with
// its own save, the outdated handling and `?edit=provider` in the address), plus legacy's Test
// Connection on the stored values and Remove. History opens the audit log of the configuration.
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'

import { ApiProblem, isApiProblem } from '@/api'
import { canAccess } from '@/app/navigation/visibility'
import { useIdentityQuery } from '@/app/session/queries'
import { lt } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { confirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'
import { CheckIcon, TrashIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import SectionNav from '../../components/SectionNav.vue'
import {
  capabilitiesOptions,
  configurationOptions,
  deleteIdentityProvider,
  forgetConfiguration,
  templateNames,
  templatesQuery as templatesQuery_,
  type IdentityProviderConfig,
} from '../api'
import ConnectionTest from '../components/ConnectionTest.vue'
import IdentityProviderForm from '../components/IdentityProviderForm.vue'
import IdentityProviderValues from '../components/IdentityProviderValues.vue'
import { useConnectionTest } from '../composables/useConnectionTest'
import { FORM_ID, useProviderEditor } from '../composables/useProviderEditor'
import { formFromConfig, toInput } from '../form-model'
import { typeLabelKey } from '../labels'

const SECTION = 'provider'

const { t } = useI18n()
const { problemMessage } = useProblemMessages()
const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const identity = useIdentityQuery()
const historyAllowed = computed(() => canAccess('auditLog', identity.data.value))

const capabilitiesQuery = useQuery(capabilitiesOptions())
const configQuery = useQuery(configurationOptions())
const capabilities = computed(() => capabilitiesQuery.data.value)
const config = computed(() => configQuery.data.value)

const editor = useProviderEditor({
  capabilities: () => capabilities.value,
  config: () => config.value,
  refetch: async () => (await configQuery.refetch()).data,
})

const templatesQuery = useQuery(
  computed(() => ({ ...templatesQuery_(), enabled: editor.form.value !== null })),
)
const templates = computed(() =>
  templatesQuery.data.value ? templateNames(templatesQuery.data.value) : [],
)
const templatesProblem = computed(() =>
  templatesQuery.isError.value && isApiProblem(templatesQuery.error.value)
    ? templatesQuery.error.value
    : templatesQuery.isError.value
      ? ApiProblem.fromParts({ kind: 'network', cause: templatesQuery.error.value })
      : null,
)

const loading = computed(
  () =>
    capabilitiesQuery.isPending.value ||
    (configQuery.isPending.value && !configQuery.isError.value),
)
const loadProblem = computed(() => {
  const error = capabilitiesQuery.error.value ?? configQuery.error.value
  if (!error || (capabilities.value && config.value !== undefined)) return null
  return isApiProblem(error) ? error : ApiProblem.fromParts({ kind: 'network', cause: error })
})
function retryLoad() {
  void capabilitiesQuery.refetch()
  void configQuery.refetch()
}

/** A page-level outcome: the configuration was removed here or elsewhere. */
const pageStatus = ref<string | null>(null)

// The first setup: legacy's form, open whenever nothing is stored.
const creating = computed(() => config.value === null && !!capabilities.value)
watch(
  creating,
  (on) => {
    if (on) editor.open(null)
  },
  { immediate: true },
)

// Section editing (UI 002 research D11): `?edit=provider` opens the form of the stored values.
const editing = computed(() => !!config.value && route.query.edit === SECTION)
watch(
  [editing, () => config.value?.etag, capabilities],
  ([on], [wasOn]) => {
    if (on && (!wasOn || !editor.form.value)) editor.open(config.value ?? null)
    if (!on && wasOn && !creating.value) editor.close()
  },
  { immediate: true },
)
watch(
  () => [route.query.edit, config.value] as const,
  ([edit, value]) => {
    if (edit === undefined || value === undefined) return
    if (edit === SECTION && value) return
    const query = { ...route.query }
    delete query.edit
    void router.replace({ query })
  },
  { immediate: true },
)

function openSection() {
  pageStatus.value = null
  editor.setStatus(null)
  void router.push({ query: { ...route.query, edit: SECTION } })
}

function closeSection() {
  const query = { ...route.query }
  delete query.edit
  const target = router.resolve({ query }).fullPath
  if (router.options.history.state.back === target) router.back()
  else void router.replace({ query })
}

useLeaveGuard(() => editor.dirty.value, { messageKey: 'leaveGuard.body' })
onBeforeRouteUpdate(async (to, from) => {
  if (to.path !== from.path || to.query.edit === from.query.edit || !editor.dirty.value) return true
  return confirm({
    title: t('leaveGuard.title'),
    description: t('leaveGuard.body'),
    confirmLabel: t('leaveGuard.leave'),
    cancelLabel: t('leaveGuard.stay'),
    destructive: true,
  })
})

/** After the page's content changed under the user: back to the top, focus on the title. */
async function focusTitle() {
  await nextTick()
  window.scrollTo({ top: 0 })
  document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true })
}

async function save() {
  const outcome = await editor.save()
  if (outcome === 'created') {
    pageStatus.value = editor.status.value?.message ?? null
    editor.status.value = null
    editor.close()
    await focusTitle()
  } else if (outcome === 'saved' || outcome === 'unchanged') {
    editor.close()
    closeSection()
  } else if (outcome === 'removed') {
    showRemoved(t('problem.identity-provider-not-configured'))
  } else if (outcome === 'outdated') {
    // The notice of what changed elsewhere opens the form: bring its top into view.
    await nextTick()
    document.getElementById(`section-${SECTION}-title`)?.focus()
  }
}

function cancel() {
  editor.close()
  closeSection()
}

function showRemoved(message: string) {
  editor.close()
  // Nothing is stored any more: legacy's empty form again.
  if (config.value === null) editor.open(null)
  pageStatus.value = message
  announce(message)
  if (route.query.edit) closeSection()
  void focusTitle()
}

// Legacy's Test Connection on the stored values: the API completes them with the stored secret.
const storedTest = useConnectionTest()
function testStored() {
  if (!config.value || !capabilities.value) return
  void storedTest.run(
    toInput(formFromConfig(config.value, capabilities.value), capabilities.value.defaults),
  )
}

// Removal (FR-039): legacy's confirmation; an outdated tag reloads and asks again.
const removal = useVersionedSave<IdentityProviderConfig>({
  current: () => config.value,
  refetch: async () => (await configQuery.refetch()).data ?? undefined,
})
const removalProblem = ref<ApiProblem | null>(null)

function askRemove(target: IdentityProviderConfig): Promise<boolean> {
  return confirm({
    title: lt('footer.confirm_delete'),
    description: `${lt('footer.delete_these_items')}: ${t(typeLabelKey(target.type))}`,
    confirmLabel: lt('footer.delete_now'),
    cancelLabel: lt('footer.cancel'),
    destructive: true,
  })
}

async function remove() {
  if (!config.value || removal.pending.value) return
  removalProblem.value = null
  editor.setStatus(null)
  if (!(await askRemove(config.value))) return
  const result = await removal.remove(
    (ifMatch) => deleteIdentityProvider(queryClient, ifMatch),
    async (latest) => (latest ? askRemove(latest) : false),
  )
  if (result.status === 'saved') {
    storedTest.reset()
    showRemoved(lt('success.item_deleted', ''))
  } else if (result.status === 'outdated' && !result.latest) {
    await forgetConfiguration(queryClient)
    showRemoved(t('problem.identity-provider-not-configured'))
  } else if (result.status === 'failed') {
    if (result.problem.is('identity-provider-not-configured')) {
      await forgetConfiguration(queryClient)
      showRemoved(t('problem.identity-provider-not-configured'))
    } else {
      removalProblem.value = result.problem
      announce(problemMessage(result.problem), { assertive: true })
    }
  }
}

const formErrors = (path: string) => editor.problemForm.errorsFor(path)
</script>

<template>
  <section class="mx-auto flex w-full max-w-5xl flex-col gap-4">
    <SectionNav />
    <PageHeader :title="lt('admin.iam')">
      <template #actions>
        <HistoryLink target-type="identityProvider" :allowed="historyAllowed" />
      </template>
    </PageHeader>
    <LegacyText k="admin.iam_description" as="p" class="-mt-4 text-gray-700 dark:text-gray-300" />

    <p
      v-if="pageStatus"
      role="status"
      data-page-status
      class="flex gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100"
    >
      <CheckIcon class="mt-0.5 size-4 shrink-0" />
      <span class="break-words">{{ pageStatus }}</span>
    </p>

    <div v-if="loading" data-page-loading role="status" aria-busy="true">
      <p class="text-gray-600 dark:text-gray-400">{{ lt('datatables.loadingRecords') }}</p>
    </div>

    <ProblemMessage v-else-if="loadProblem" :problem="loadProblem" retry @retry="retryLoad" />

    <form
      v-else-if="creating && editor.form.value && capabilities"
      data-setup
      class="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
      novalidate
      @submit.prevent="save"
    >
      <ErrorSummary :id="editor.problemForm.summaryId" :items="editor.problemForm.summary.value" />
      <p
        v-if="editor.status.value?.kind === 'error'"
        role="alert"
        class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        {{ editor.status.value.message }}
      </p>
      <ProblemMessage :problem="editor.problemForm.formProblem.value" />
      <IdentityProviderForm
        v-model:form="editor.form.value"
        :id-prefix="FORM_ID"
        :capabilities="capabilities"
        :templates="templates"
        :templates-problem="templatesProblem"
        :secret="editor.secret.value"
        :keeps-stored="editor.keepsStored.value"
        :errors-for="formErrors"
        :test="{
          running: editor.test.running.value,
          result: editor.test.result.value,
          noResult: editor.test.noResult.value,
          problem: editor.test.problem.value,
        }"
        @test="editor.runTest"
        @retry-templates="templatesQuery.refetch()"
      />
      <div class="flex justify-end">
        <button type="submit" :class="buttonVariants({})" :disabled="editor.saving.value">
          {{ editor.saving.value ? t('sections.saving') : lt('admin.save') }}
        </button>
      </div>
    </form>

    <EditableSection
      v-else-if="config && capabilities"
      :section-id="SECTION"
      :title="t(typeLabelKey(config.type))"
      editable
      :editing="editing && !!editor.form.value"
      :saving="editor.saving.value"
      :status="editor.status.value"
      :outdated="editor.outdated.value"
      :save-label="lt('admin.save')"
      @edit="openSection"
      @cancel="cancel"
      @save="save"
      @save-again="save"
      @discard="editor.discard"
    >
      <div class="flex flex-col gap-4">
        <IdentityProviderValues :config="config" :id-prefix="`${FORM_ID}-stored`" />
        <ConnectionTest
          :running="storedTest.running.value"
          :result="storedTest.result.value"
          :no-result="storedTest.noResult.value"
          :problem="storedTest.problem.value"
          @test="testStored"
        />
        <ProblemMessage :problem="removalProblem" />
        <div class="flex justify-end">
          <button
            type="button"
            :class="buttonVariants({ variant: 'destructive' })"
            :disabled="removal.pending.value"
            @click="remove"
          >
            <TrashIcon />
            {{ lt('mailbox.remove') }}
          </button>
        </div>
      </div>
      <template #form>
        <ErrorSummary
          :id="editor.problemForm.summaryId"
          :items="editor.problemForm.summary.value"
        />
        <ProblemMessage :problem="editor.problemForm.formProblem.value" />
        <IdentityProviderForm
          v-if="editor.form.value"
          v-model:form="editor.form.value"
          :id-prefix="FORM_ID"
          :capabilities="capabilities"
          :templates="templates"
          :templates-problem="templatesProblem"
          :secret="editor.secret.value"
          :keeps-stored="editor.keepsStored.value"
          :errors-for="formErrors"
          :test="{
            running: editor.test.running.value,
            result: editor.test.result.value,
            noResult: editor.test.noResult.value,
            problem: editor.test.problem.value,
          }"
          @test="editor.runTest"
          @retry-templates="templatesQuery.refetch()"
        />
      </template>
    </EditableSection>
  </section>
</template>
