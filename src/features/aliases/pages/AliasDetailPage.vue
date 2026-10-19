<script setup lang="ts">
// The alias page (US1 FR-016, US3), mirroring `templates/edit/alias.twig` (docs/conventions.md
// "Detail pages"): legacy's edit heading with the address, the data the classic list shows (ID,
// domain, target domain, the Catch-All badge) and the orphaned warning, then the "Edit alias" form
// as one section. Deletion and "Expand alias over alias domains" stay in the list, as in legacy.
// An alias that does not exist or lies outside the scope shows "not found" with a way back (FR-003).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import { isApiProblem, problemOf } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import { isEntryAvailable } from '@/app/navigation/visibility'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { lt } from '@/i18n'
import EditableSection from '@/shared/components/EditableSection.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import OutcomeAlert from '@/shared/components/OutcomeAlert.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'

import { useAlias } from '../api'
import { useAliasesCapabilities } from '../capabilities'
import AliasBadges from '../components/AliasBadges.vue'
import AliasValues from '../components/AliasValues.vue'
import OrphanedAliasWarning from '../components/OrphanedAliasWarning.vue'
import { takeAliasFlash } from '../flash'
import { feature004Permissions } from '../permissions'

const { t } = useI18n()
const route = useRoute()
const identity = useIdentityQuery()
const capabilities = useAliasesCapabilities()
const permissions = computed(() =>
  feature004Permissions(identity.data.value, capabilities.data.value),
)
const groupwareEnabled = computed(() => capabilities.data.value?.groupwareEnabled)

const id = computed(() => Number(route.params.aliasId))
/** The outcome of the creation that opened this page (legacy's `success.alias_added`). */
const flash = ref<string | null>(takeAliasFlash(id.value))
const query = useAlias(id)
const alias = computed(() => query.data.value)
const notFound = computed(
  () => !alias.value && isApiProblem(query.error.value) && query.error.value.status === 404,
)
const linkDomains = computed(
  () => isEntryAvailable('domains', identity.data.value) && !alias.value?.orphaned,
)
/** The alias's own domain links to its screen: an alias domain's (US4) or a domain's (UI 002). */
const domainLink = computed(() => {
  const value = alias.value
  if (!value || value.orphaned) return null
  if (value.inAliasDomain) {
    return isEntryAvailable('aliasDomains', identity.data.value)
      ? { name: 'alias-domain-detail', params: { aliasDomain: value.domain } }
      : null
  }
  return linkDomains.value ? { name: 'domain-detail', params: { domain: value.domain } } : null
})
const subtitle = computed(() =>
  alias.value
    ? alias.value.addressUnicode === alias.value.address
      ? alias.value.address
      : `${alias.value.addressUnicode} (${alias.value.address})`
    : '',
)
const DT = 'text-sm text-gray-600 dark:text-gray-400'
const DD = 'min-w-0 break-words text-gray-900 dark:text-white'
const LINK =
  'inline-flex min-h-11 items-center break-all text-brand-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400'
</script>

<template>
  <NotFoundPage
    v-if="notFound"
    :back-to="{ name: 'aliases' }"
    :back-label="t('lists.backToList')"
  />
  <div
    v-else-if="!alias && query.isPending.value"
    data-page-loading
    role="status"
    aria-busy="true"
    class="mx-auto w-full max-w-5xl"
  >
    <p class="text-gray-600 dark:text-gray-400">{{ lt('datatables.loadingRecords') }}</p>
  </div>
  <section v-else-if="!alias" class="mx-auto flex w-full max-w-5xl flex-col gap-3">
    <h1
      tabindex="-1"
      class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
    >
      {{ lt('edit.alias') }}
    </h1>
    <p role="alert" class="font-medium text-gray-900 dark:text-white">
      {{ t('states.detail.error') }}
    </p>
    <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
  </section>
  <article v-else class="mx-auto flex w-full max-w-5xl flex-col gap-4">
    <PageHeader :title="lt('edit.alias')" :description="subtitle">
      <template #actions><slot name="header-actions" :alias="alias" /></template>
    </PageHeader>
    <OutcomeAlert v-if="flash" :message="flash" @dismiss="flash = null" />
    <OrphanedAliasWarning v-if="permissions.canSeeOrphaned && alias.orphaned" />
    <section
      :aria-label="lt('edit.alias')"
      class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
      data-alias-summary
    >
      <dl class="grid grid-cols-1 gap-3 md:grid-cols-[minmax(10rem,auto)_1fr] md:gap-x-6">
        <dt :class="DT">{{ t('lists.id') }}</dt>
        <dd :class="DD">{{ alias.id }}</dd>
        <dt :class="DT">{{ lt('mailbox.domain') }}</dt>
        <dd :class="DD" data-field="domain">
          <RouterLink v-if="domainLink" :to="domainLink" :class="LINK">{{
            alias.domainUnicode
          }}</RouterLink>
          <span v-else class="break-all">{{ alias.domainUnicode }}</span>
        </dd>
        <template v-if="alias.inAliasDomain">
          <dt :class="DT">{{ lt('mailbox.target_domain') }}</dt>
          <dd :class="DD" data-field="primaryDomain">
            <RouterLink
              v-if="linkDomains"
              :to="{ name: 'domain-detail', params: { domain: alias.primaryDomain } }"
              :class="LINK"
              >{{ alias.primaryDomainUnicode }}</RouterLink
            >
            <span v-else class="break-all">{{ alias.primaryDomainUnicode }}</span>
          </dd>
        </template>
      </dl>
      <AliasBadges class="mt-3" :alias="alias" :can-see-orphaned="permissions.canSeeOrphaned" />
    </section>
    <slot name="sections" :alias="alias" :groupware-enabled="groupwareEnabled">
      <EditableSection
        section-id="alias"
        :title="lt('edit.alias')"
        :editable="false"
        :editing="false"
      >
        <AliasValues :alias="alias" :groupware-enabled="groupwareEnabled" />
      </EditableSection>
    </slot>
  </article>
</template>
