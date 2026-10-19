<script setup lang="ts">
// The resource page (US7, FR-046, FR-048), mirroring `templates/edit/resource.twig`
// (docs/conventions.md "Detail pages"): legacy's edit heading with the address, the outcome alert of
// the creation that opened it, the address and domain display-only with the list's keys, then the
// "Resource" form as one section (`?edit=resource`). Deletion stays in the list, as in legacy, and
// a resource has no "Send as". Below md the open section takes the screen; leaving it with changes
// asks first. A resource that does not exist or lies outside the scope shows "not found" (FR-003);
// one that vanishes on a save or a refresh sends the user back to the list with a message (FR-028).
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'

import { isApiProblem, problemOf } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { feature004Permissions, useAliasesCapabilities } from '@/features/aliases'
import { lt } from '@/i18n'
import OutcomeAlert from '@/shared/components/OutcomeAlert.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useConfirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import { useResource } from '../api'
import ResourceSection from '../components/ResourceSection.vue'
import { setResourceListFlash, takeResourceFlash } from '../flash'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const wide = useMediaQuery('(min-width: 768px)')
const identity = useIdentityQuery()
const capabilities = useAliasesCapabilities()
const permissions = computed(() => feature004Permissions(identity.data.value, null))

const address = computed(() => String(route.params.resourceAddress ?? ''))
const query = useResource(address)
const resource = computed(() => query.data.value)
const flash = ref(takeResourceFlash(address.value))
const notFound = computed(
  () => !resource.value && isApiProblem(query.error.value) && query.error.value.status === 404,
)

const editing = computed(() => route.query.edit === 'resource' && !!resource.value)
const dirty = ref(false)
watch(
  [() => route.query.edit, () => !!resource.value],
  ([value, loaded]) => {
    if (value === undefined || !loaded || value === 'resource') return
    const next = { ...route.query }
    delete next.edit
    void router.replace({ query: next })
  },
  { immediate: true },
)

function openSection() {
  void router.push({ query: { ...route.query, edit: 'resource' } })
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

/** The resource no longer exists or left the scope: back to the list, which says so. */
function vanished() {
  dirty.value = false
  guard.disarm()
  setResourceListFlash('danger', t('resources.gone'))
  void router.replace({ name: 'resources' })
}
watch(
  () => !!resource.value && isApiProblem(query.error.value) && query.error.value.status === 404,
  (gone) => {
    if (gone) vanished()
  },
)

const showOnly = computed(() => !wide.value && editing.value)

const DT = 'text-sm text-gray-600 dark:text-gray-400'
const DD = 'min-w-0 break-all text-gray-900 dark:text-white'
</script>

<template>
  <NotFoundPage
    v-if="notFound"
    :back-to="{ name: 'resources' }"
    :back-label="t('lists.backToList')"
  />
  <div
    v-else-if="!resource && query.isPending.value"
    data-page-loading
    role="status"
    aria-busy="true"
    class="mx-auto w-full max-w-5xl"
  >
    <p class="text-gray-600 dark:text-gray-400">{{ lt('datatables.loadingRecords') }}</p>
  </div>
  <section v-else-if="!resource" class="mx-auto flex w-full max-w-5xl flex-col gap-3">
    <h1
      tabindex="-1"
      class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
    >
      {{ lt('edit.resource') }}
    </h1>
    <p role="alert" class="font-medium text-gray-900 dark:text-white">
      {{ t('states.detail.error') }}
    </p>
    <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
  </section>
  <article v-else class="mx-auto flex w-full max-w-5xl flex-col gap-4">
    <template v-if="!showOnly">
      <PageHeader :title="lt('edit.resource')" :description="resource.addressUnicode">
        <template #actions>
          <HistoryLink
            target-type="resource"
            :target-id="resource.address"
            :allowed="permissions.canSeeHistory"
          />
        </template>
      </PageHeader>
      <OutcomeAlert v-if="flash" :message="flash" @dismiss="flash = null" />
      <section
        :aria-label="lt('edit.resource')"
        data-resource-summary
        class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
      >
        <dl class="grid grid-cols-1 gap-3 md:grid-cols-[minmax(10rem,auto)_1fr] md:gap-x-6">
          <dt :class="DT">{{ lt('mailbox.alias') }}</dt>
          <dd :class="DD" data-field="address">{{ resource.addressUnicode }}</dd>
          <dt :class="DT">{{ lt('mailbox.domain') }}</dt>
          <dd :class="DD" data-field="domain">{{ resource.domainUnicode }}</dd>
        </dl>
      </section>
    </template>
    <ResourceSection
      :resource="resource"
      :editing="editing"
      :editable="permissions.canManageResources"
      :capabilities="capabilities.data.value"
      @edit="openSection"
      @close="closeSection"
      @dirty="dirty = $event"
      @gone="vanished"
    />
  </article>
</template>
