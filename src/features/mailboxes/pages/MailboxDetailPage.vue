<script setup lang="ts">
// The mailbox page (US1, US3, US5, US8; FR-015 to FR-017), mirroring the classic page
// `templates/edit/mailbox.twig` (owner rule 1:1, docs/conventions.md "Detail pages"): legacy's
// edit heading with the address, the usage figures with the list's keys (display-only), then the
// tabs as sections in legacy order: "Mailbox", "Custom attributes", "Pushover" (read-only until
// UI 005), "ACL", "Rate limit" (UI 006's section) and "Rename mailbox". Deletion stays in the
// list, as in legacy. A section opens for editing with `?edit=<section>`, one at a time, so each has
// its own link; leaving a section with changes asks first. A mailbox opened from the list shows at
// once from the list entry and is refreshed (FR-017); another spelling of the address is replaced by
// the canonical one; a mailbox that does not exist or lies outside the scope shows the not-found
// page with a way back to the list (FR-004).
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'

import { isApiProblem, problemOf, queryKeys } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { canAccess } from '@/app/navigation/visibility'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { lt, resolveText, type LegacyKey } from '@/i18n'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useConfirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import { RateLimitSection } from '@/features/rate-limits'
import { MailboxSyncJobsLink } from '@/features/sync-jobs'

import { useMailbox } from '../api'
import MailboxUsage from '../components/display/MailboxUsage.vue'
import AclSection from '../components/sections/AclSection.vue'
import AttributesSection from '../components/sections/AttributesSection.vue'
import MailboxSection from '../components/sections/MailboxSection.vue'
import ManagedSections from '../components/sections/ManagedSections.vue'
import RenameSection from '../components/sections/RenameSection.vue'
import { useMailboxCapabilities } from '../composables/useMailboxCapabilities'
import { takeMailboxFlash, type MailboxFlash } from '../flash'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const confirm = useConfirm()
const identityQuery = useIdentityQuery()
const identity = computed(() => identityQuery.data.value ?? null)
const capabilitiesQuery = useMailboxCapabilities()
const capabilities = computed(() => capabilitiesQuery.data.value)
const historyAllowed = computed(() => canAccess('auditLog', identity.value))
const wide = useMediaQuery('(min-width: 768px)')

const address = computed(() => String(route.params.address ?? ''))
const query = useMailbox(address)
const mailbox = computed(() => query.data.value)
const notFound = computed(
  () => !mailbox.value && isApiProblem(query.error.value) && query.error.value.status === 404,
)
const gone = computed(
  () => !!mailbox.value && isApiProblem(query.error.value) && query.error.value.status === 404,
)

// The outcome an action left for this address (a rename, a creation), shown once and announced.
const flashes = ref<MailboxFlash[]>([])
watch(
  address,
  (value) => {
    flashes.value = takeMailboxFlash(value)
    for (const flash of flashes.value) announce(resolveText(flash.text, t))
  },
  { immediate: true },
)

const SECTION_TITLES: Record<string, LegacyKey> = {
  mailbox: 'edit.mailbox',
  attributes: 'edit.custom_attributes',
  acl: 'edit.acl',
}
const requested = computed(() => (typeof route.query.edit === 'string' ? route.query.edit : null))
const editing = computed(() =>
  requested.value && SECTION_TITLES[requested.value] ? requested.value : null,
)
const dirty = ref(false)
const reason = (id: string) =>
  editing.value && editing.value !== id
    ? t('sections.editDisabled', { section: lt(SECTION_TITLES[editing.value]!) })
    : null

watch(
  [requested, () => !!mailbox.value],
  ([value, loaded]) => {
    if (!value || !loaded || editing.value !== null) return
    const next = { ...route.query }
    delete next.edit
    void router.replace({ query: next, hash: route.hash })
  },
  { immediate: true },
)

function openSection(id: string) {
  void router.push({ query: { ...route.query, edit: id }, hash: route.hash })
}

function closeSection() {
  const next = { ...route.query }
  delete next.edit
  const previous = router.options.history.state.back
  const target = router.resolve({ query: next, hash: route.hash }).fullPath
  if (previous === target) router.back()
  else void router.replace({ query: next, hash: route.hash })
}

useLeaveGuard(dirty, { messageKey: 'leaveGuard.body' })
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

const showOnly = computed(() => (!wide.value && editing.value ? editing.value : null))
const visible = (id: string) => !showOnly.value || showOnly.value === id

function sectionProps(id: string) {
  return {
    mailbox: mailbox.value!,
    editing: editing.value === id,
    editDisabledReason: reason(id),
    capabilities: capabilities.value,
    identity: identity.value,
  }
}

// One mailbox, one address (the API's lower-case ASCII form).
watch(
  mailbox,
  (value) => {
    if (!value || value.address === address.value) return
    queryClient.setQueryData(queryKeys.mailboxes.detail(value.address), value)
    void router.replace({
      name: 'mailbox-detail',
      params: { address: value.address },
      query: route.query,
      hash: route.hash,
    })
  },
  { immediate: true },
)

const subtitle = computed(() => {
  const value = mailbox.value
  if (!value) return address.value
  return value.domainUnicode === value.domain
    ? value.address
    : `${value.localPart}@${value.domainUnicode} (${value.address})`
})
</script>

<template>
  <NotFoundPage
    v-if="notFound"
    :back-to="{ path: '/mailboxes' }"
    :back-label="t('mailboxes.detail.backToList')"
  />
  <div
    v-else-if="!mailbox && query.isPending.value"
    data-page-loading
    role="status"
    aria-busy="true"
    class="mx-auto w-full max-w-5xl"
  >
    <p class="text-gray-600 dark:text-gray-400">{{ lt('datatables.loadingRecords') }}</p>
  </div>
  <section v-else-if="!mailbox" class="mx-auto flex w-full max-w-5xl flex-col gap-3">
    <h1
      tabindex="-1"
      class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
    >
      {{ lt('edit.mailbox') }}
    </h1>
    <p role="alert" class="font-medium text-gray-900 dark:text-white">
      {{ t('mailboxes.detail.loadFailed') }}
    </p>
    <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
  </section>
  <article
    v-else
    class="mx-auto flex w-full max-w-5xl flex-col gap-4"
    :data-mailbox="mailbox.address"
  >
    <template v-if="!showOnly">
      <PageHeader :title="lt('edit.mailbox')" :description="subtitle">
        <template #actions>
          <HistoryLink
            target-type="mailbox"
            :target-id="mailbox.address"
            :allowed="historyAllowed"
          />
          <!-- UI 008 (FR-004): the mailbox's sync jobs, for whoever may open them. -->
          <MailboxSyncJobsLink :address="mailbox.address" />
        </template>
      </PageHeader>
      <p
        v-if="gone"
        role="alert"
        class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        {{ t('mailboxes.detail.gone') }}
      </p>
      <p
        v-for="(flash, index) in flashes"
        :key="index"
        :role="flash.kind === 'success' ? 'status' : 'alert'"
        :data-flash="flash.kind"
        class="rounded-xl border p-3 text-sm wrap-anywhere"
        :class="
          flash.kind === 'success'
            ? 'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100'
            : flash.kind === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100'
              : 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100'
        "
      >
        {{ resolveText(flash.text, t) }}
      </p>
      <MailboxUsage :mailbox="mailbox" :capabilities="capabilities" />
    </template>
    <MailboxSection
      v-if="visible('mailbox')"
      v-bind="sectionProps('mailbox')"
      @edit="openSection('mailbox')"
      @close="closeSection"
      @dirty="dirty = $event"
    />
    <AttributesSection
      v-if="visible('attributes')"
      v-bind="sectionProps('attributes')"
      @edit="openSection('attributes')"
      @close="closeSection"
      @dirty="dirty = $event"
    />
    <ManagedSections v-if="!showOnly" :mailbox="mailbox" section="pushover" />
    <AclSection
      v-if="visible('acl')"
      v-bind="sectionProps('acl')"
      @edit="openSection('acl')"
      @close="closeSection"
      @dirty="dirty = $event"
    />
    <!-- UI 006: legacy's "Rate limit" tab (`#mrl`), reached with `#rate-limit`. -->
    <RateLimitSection v-if="!showOnly" kind="mailbox" :object="mailbox.address" />
    <RenameSection v-if="!showOnly" :mailbox="mailbox" @dirty="dirty = $event" />
  </article>
</template>
