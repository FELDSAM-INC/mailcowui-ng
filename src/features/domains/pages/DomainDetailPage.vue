<script setup lang="ts">
// The domain page (UI 002 US1, US3, FR-015 to FR-017), mirroring the classic page
// `templates/edit/domain.twig` (owner rule 1:1, docs/conventions.md "Detail pages"): legacy's edit
// heading with the domain name, the creation outcomes after a creation, the usage figures and the
// domain administrators (display-only, with the domain list's keys), then the tabs it delivers as
// sections in legacy order: "Edit domain", "Rate limit" (read-only until its feature lands) and
// "Domain wide footer". Deletion stays in the list, as in legacy. The domain is seeded
// from a cached list entry; another spelling of its name in the address is replaced by the canonical
// ASCII address (research D4); a domain that does not exist or lies outside the scope shows the
// not-found page with a way back to the list (FR-004).
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'

import { lt, type LegacyKey } from '@/i18n'
import { isApiProblem, queryKeys, type DomainCreationReport } from '@/api'
import { canAccess } from '@/app/navigation/visibility'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useConfirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'

import { problemOf, useDomain } from '../api'
import { useDomainCapabilities } from '../capabilities'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PageHeader from '@/shared/components/PageHeader.vue'

import CreationReport from '@/shared/components/CreationReport.vue'
import { creationAlerts } from '../creation-report'
import DomainAdminsList from '../components/detail/DomainAdminsList.vue'
import DomainSection from '../components/detail/sections/DomainSection.vue'
import FooterSection from '../components/detail/sections/FooterSection.vue'
import RateLimitSection from '../components/detail/sections/RateLimitSection.vue'
import UsageSummary from '../components/detail/UsageSummary.vue'
import { useDomainPermissions } from '../composables/useDomainPermissions'
import type { EditableAttribute } from '../permissions'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const confirm = useConfirm()
const { identity, permissions } = useDomainPermissions()
const capabilities = useDomainCapabilities()
/** The domain's history (FR-063) for whoever may open the audit log: administrators. */
const historyAllowed = computed(() => canAccess('auditLog', identity.data.value))
const wide = useMediaQuery('(min-width: 768px)')

const name = computed(() => String(route.params.domain ?? ''))
const query = useDomain(name)
const domain = computed(() => query.data.value)
const notFound = computed(
  () => !domain.value && isApiProblem(query.error.value) && query.error.value.status === 404,
)

// Research D7: the report of a creation is taken from the cache once and shown until dismissed.
const report = ref<DomainCreationReport | null>(null)
watch(
  name,
  (value) => {
    const key = queryKeys.domains.creationReport(value)
    const cached = queryClient.getQueryData<DomainCreationReport>(key)
    if (cached) {
      report.value = cached
      queryClient.removeQueries({ queryKey: key, exact: true })
    }
  },
  { immediate: true },
)

// Section editing (research D11, data-model §5): `edit` in the address opens one section; an
// unknown or not editable section is removed; one section at a time; leaving or closing a section
// with unsaved changes asks first.
const SECTION_FIELDS: Record<string, readonly EditableAttribute[]> = {
  domain: [
    'description',
    'tags',
    'maxAliases',
    'maxMailboxes',
    'maxMailboxQuota',
    'domainQuota',
    'backupMx',
    'relayAllRecipients',
    'relayUnknownOnly',
    'globalAddressList',
    'active',
  ],
}
const SECTION_TITLES: Record<string, LegacyKey> = {
  domain: 'edit.domain',
  footer: 'edit.domain_footer',
}
const editableFields = computed(() => permissions.value.editable)
const isEditable = (id: string) =>
  id === 'footer'
    ? permissions.value.canEditFooter
    : (SECTION_FIELDS[id] ?? []).some((field) => editableFields.value.has(field))
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
  [requested, () => !!domain.value, () => !!identity.data.value],
  ([value, loaded, known]) => {
    if (!value || !loaded || !known) return
    if (editing.value !== null && isEditable(value)) return
    const query = { ...route.query }
    delete query.edit
    void router.replace({ query, hash: route.hash })
  },
  { immediate: true },
)

function openSection(id: string) {
  void router.push({ query: { ...route.query, edit: id }, hash: route.hash })
}

function closeSection() {
  const query = { ...route.query }
  delete query.edit
  const previous = router.options.history.state.back
  const target = router.resolve({ query, hash: route.hash }).fullPath
  if (previous === target) router.back()
  else void router.replace({ query, hash: route.hash })
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
    editableFields: editableFields.value,
    editing: editing.value === id,
    editDisabledReason: reason(id),
    capabilities: capabilities.data.value,
  }
}

// Research D4: one domain, one address.
watch(
  domain,
  (value) => {
    if (!value || value.name === name.value) return
    queryClient.setQueryData(queryKeys.domains.detail(value.name), value)
    void router.replace({
      name: 'domain-detail',
      params: { domain: value.name },
      query: route.query,
      hash: route.hash,
    })
  },
  { immediate: true },
)
</script>

<template>
  <NotFoundPage
    v-if="notFound"
    :back-to="{ name: 'domains' }"
    :back-label="t('domains.detail.backToList')"
  />
  <div
    v-else-if="!domain && query.isPending.value"
    data-page-loading
    role="status"
    aria-busy="true"
    class="mx-auto w-full max-w-5xl"
  >
    <p class="text-gray-600 dark:text-gray-400">{{ t('domains.detail.loading') }}</p>
  </div>
  <section v-else-if="!domain" class="mx-auto flex w-full max-w-5xl flex-col gap-3">
    <h1
      tabindex="-1"
      class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
    >
      {{ lt('edit.domain') }}
    </h1>
    <p role="alert" class="font-medium text-gray-900 dark:text-white">
      {{ t('domains.detail.loadFailed') }}
    </p>
    <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
  </section>
  <article v-else class="mx-auto flex w-full max-w-5xl flex-col gap-4">
    <template v-if="!showOnly">
      <PageHeader
        :title="lt('edit.domain')"
        :description="
          domain.unicodeName === domain.name
            ? domain.name
            : `${domain.unicodeName} (${domain.name})`
        "
      >
        <template #actions>
          <HistoryLink :target-id="domain.name" :allowed="historyAllowed" />
        </template>
      </PageHeader>
      <CreationReport
        v-if="report"
        :alerts="creationAlerts(domain.name, report)"
        @dismiss="report = null"
      />
      <UsageSummary :domain="domain" />
      <DomainAdminsList v-if="permissions.canSeeDomainAdmins" :admins="domain.domainAdmins ?? []" />
    </template>
    <DomainSection
      v-if="visible('domain')"
      :domain="domain"
      :identity="identity.data.value"
      v-bind="sectionProps('domain')"
      @edit="openSection('domain')"
      @close="closeSection"
      @dirty="dirty = $event"
    />
    <RateLimitSection v-if="!showOnly" :domain="domain" />
    <FooterSection
      v-if="visible('footer')"
      :domain="domain"
      :editable="permissions.canEditFooter"
      :editing="editing === 'footer'"
      :edit-disabled-reason="reason('footer')"
      :capabilities="capabilities.data.value"
      @edit="openSection('footer')"
      @close="closeSection"
      @dirty="dirty = $event"
    />
  </article>
</template>
