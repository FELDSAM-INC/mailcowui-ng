<script setup lang="ts">
// The domain alias page (US4, FR-035, FR-039), mirroring `templates/edit/aliasdomain.twig`
// (docs/conventions.md "Detail pages"): legacy's edit heading with the name, the outcome alerts of
// the creation that opened it, the "Edit Alias domain" form as one section (`?edit=general`), then
// legacy's rate limit form below it (UI 006's section, `acl.ratelimit`, `#rate-limit`). Deletion
// stays in the list, as in legacy. Below md the open section takes the screen; leaving it with
// changes asks first. A name in another spelling is replaced by the canonical ASCII name. An alias
// domain that does not exist or lies outside the scope shows "not found" (FR-003); one that vanishes
// on a save or a refresh sends the user back to the list with a message (FR-028).
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'

import { isApiProblem, problemOf, queryKeys } from '@/api'
import { isEntryAvailable } from '@/app/navigation/visibility'
import { useIdentityQuery } from '@/app/session/queries'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { feature004Permissions } from '@/features/aliases-common'
import { RateLimitSection } from '@/features/rate-limits'
import { SpamFilterSection } from '@/features/spam-filter'
import { lt } from '@/i18n'
import CreationReport from '@/shared/components/CreationReport.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useConfirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import { useAliasDomain } from '../api'
import AliasDomainGeneralSection from '../components/AliasDomainGeneralSection.vue'
import { setAliasDomainListFlash, takeCreationFlash } from '../flash'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const confirm = useConfirm()
const wide = useMediaQuery('(min-width: 768px)')
const identity = useIdentityQuery()
const permissions = computed(() => feature004Permissions(identity.data.value, null))
const linkDomains = computed(() => isEntryAvailable('domains', identity.data.value))

const name = computed(() => String(route.params.aliasDomain ?? ''))
const query = useAliasDomain(name)
const aliasDomain = computed(() => query.data.value)
const alerts = ref(takeCreationFlash(name.value))
const notFound = computed(
  () => !aliasDomain.value && isApiProblem(query.error.value) && query.error.value.status === 404,
)

// One alias domain, one address (the API's lower-case ASCII name).
watch(
  aliasDomain,
  (value) => {
    if (!value || value.name === name.value) return
    queryClient.setQueryData(queryKeys.aliasDomains.detail(value.name), value)
    void router.replace({
      name: 'alias-domain-detail',
      params: { aliasDomain: value.name },
      query: route.query,
    })
  },
  { immediate: true },
)

const editing = computed(() => route.query.edit === 'general' && !!aliasDomain.value)
const dirty = ref(false)
watch(
  [() => route.query.edit, () => !!aliasDomain.value],
  ([value, loaded]) => {
    if (value === undefined || !loaded || value === 'general') return
    const next = { ...route.query }
    delete next.edit
    void router.replace({ query: next })
  },
  { immediate: true },
)

function openSection() {
  void router.push({ query: { ...route.query, edit: 'general' } })
}

function closeSection() {
  const next = { ...route.query }
  delete next.edit
  const previous = router.options.history.state.back
  const target = router.resolve({ query: next }).fullPath
  if (previous === target) router.back()
  else void router.replace({ query: next })
}

const guard = useLeaveGuard(dirty, { messageKey: 'leaveGuard.body' })
onBeforeRouteUpdate(async (to, from) => {
  if (to.path !== from.path || !dirty.value || to.query.edit === from.query.edit) return true
  const leave = await confirm({
    title: t('leaveGuard.title'),
    description: t('leaveGuard.body'),
    confirmLabel: t('leaveGuard.leave'),
    cancelLabel: t('leaveGuard.stay'),
    destructive: true,
  })
  if (leave) dirty.value = false
  return leave
})

/** The alias domain no longer exists or left the scope: back to the list, which says so. */
function vanished() {
  dirty.value = false
  guard.disarm()
  setAliasDomainListFlash('danger', t('aliasDomains.gone'))
  void router.replace({ name: 'alias-domains' })
}
watch(
  () => !!aliasDomain.value && isApiProblem(query.error.value) && query.error.value.status === 404,
  (gone) => {
    if (gone) vanished()
  },
)

const showOnly = computed(() => !wide.value && editing.value)

const subtitle = computed(() => {
  const value = aliasDomain.value
  if (!value) return name.value
  return value.nameUnicode === value.name ? value.name : `${value.nameUnicode} (${value.name})`
})
</script>

<template>
  <NotFoundPage
    v-if="notFound"
    :back-to="{ name: 'alias-domains' }"
    :back-label="t('lists.backToList')"
  />
  <div
    v-else-if="!aliasDomain && query.isPending.value"
    data-page-loading
    role="status"
    aria-busy="true"
    class="mx-auto w-full max-w-5xl"
  >
    <p class="text-gray-600 dark:text-gray-400">{{ lt('datatables.loadingRecords') }}</p>
  </div>
  <section v-else-if="!aliasDomain" class="mx-auto flex w-full max-w-5xl flex-col gap-3">
    <h1
      tabindex="-1"
      class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
    >
      {{ lt('edit.edit_alias_domain') }}
    </h1>
    <p role="alert" class="font-medium text-gray-900 dark:text-white">
      {{ t('states.detail.error') }}
    </p>
    <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
  </section>
  <article v-else class="mx-auto flex w-full max-w-5xl flex-col gap-4">
    <template v-if="!showOnly">
      <PageHeader :title="lt('edit.edit_alias_domain')" :description="subtitle">
        <template #actions>
          <HistoryLink
            target-type="aliasDomain"
            :target-id="aliasDomain.name"
            :allowed="permissions.canSeeHistory"
          />
        </template>
      </PageHeader>
      <CreationReport v-if="alerts" :alerts="alerts" @dismiss="alerts = null" />
    </template>
    <AliasDomainGeneralSection
      :alias-domain="aliasDomain"
      :editing="editing"
      :editable="permissions.canManageAliasDomains"
      :link-domains="linkDomains"
      @edit="openSection"
      @close="closeSection"
      @dirty="dirty = $event"
      @gone="vanished"
    />
    <!-- UI 006: legacy's rate limit form below the edit form, reached with `#rate-limit`. -->
    <RateLimitSection v-if="!showOnly" kind="aliasDomain" :object="aliasDomain.name" />
    <SpamFilterSection v-if="!showOnly" kind="aliasDomain" :owner="aliasDomain.name" />
  </article>
</template>
