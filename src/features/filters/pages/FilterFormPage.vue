<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { isApiProblem, problemOf, type SieveFilter } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import NoAccessState from '@/app/states/NoAccessState.vue'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { MailboxContextHeader } from '@/features/account'
import { lt } from '@/i18n'
import AclReadOnlyNote from '@/shared/components/AclReadOnlyNote.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useFilter } from '../api'
import FilterForm from '../components/FilterForm.vue'
import ScriptBlock from '../components/ScriptBlock.vue'
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const identity = useIdentityQuery()
const canChange = computed(
  () =>
    identity.data.value?.role === 'admin' ||
    (identity.data.value?.role === 'domainAdmin' && identity.data.value.permissions.filters),
)
const mailbox = computed(() =>
  typeof route.params.address === 'string' ? route.params.address.toLowerCase() : '',
)
const id = computed(() => Number(route.params.filterId ?? 0))
const creating = computed(() => !route.params.filterId)
const query = useFilter(id, mailbox)
const item = computed(() => query.data.value)
const title = computed(
  () => `${t('filters.form.title')}${item.value ? `: ${item.value.description}` : ''}`,
)
const notFound = computed(() => isApiProblem(query.error.value) && query.error.value.status === 404)
const listLocation = computed(() => ({
  name: mailbox.value ? 'mailbox-filters' : 'filters',
  params: mailbox.value ? { address: mailbox.value } : {},
}))
function saved(value: SieveFilter) {
  if (creating.value)
    void router.replace({
      name: mailbox.value ? 'mailbox-filter-detail' : 'filter-detail',
      params: { ...(mailbox.value ? { address: mailbox.value } : {}), filterId: value.id },
    })
}
</script>
<template>
  <NoAccessState v-if="creating && !canChange" />
  <NotFoundPage v-else-if="notFound" :back-to="listLocation" :back-label="lt('mailbox.filters')" />
  <section v-else class="flex min-w-0 flex-col gap-5">
    <RouterLink :to="listLocation" class="inline-flex min-h-11 items-center self-start underline">{{
      lt('mailbox.filters')
    }}</RouterLink>
    <MailboxContextHeader v-if="mailbox" :title="title" target-type="sieveFilter" />
    <PageHeader v-else :title="title" :description="item?.mailbox">
      <template v-if="item && identity.data.value?.role === 'admin'" #actions>
        <HistoryLink target-type="sieveFilter" :target-id="item.mailbox" allowed />
      </template>
    </PageHeader>
    <AclReadOnlyNote v-if="!canChange && !mailbox" id="filter-read-only" flag="filters" />
    <FilterForm
      v-if="creating"
      :key="`new:${mailbox}`"
      :mailbox="mailbox || undefined"
      @saved="saved"
    />
    <p v-else-if="query.isPending.value" role="status" aria-busy="true">
      {{ lt('datatables.loadingRecords') }}
    </p>
    <ProblemMessage
      v-else-if="query.isError.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <template v-else-if="item">
      <FilterForm
        v-if="canChange"
        :key="`${item.mailbox}:${item.id}`"
        :mailbox="item.mailbox"
        :stored="item"
        @saved="saved"
      />
      <template v-else>
        <dl class="flex flex-col gap-3 text-gray-800 dark:text-gray-200">
          <div>
            <dt class="font-medium">{{ lt('mailbox.owner') }}</dt>
            <dd class="wrap-anywhere">{{ item.mailbox }}</dd>
          </div>
          <div>
            <dt class="font-medium">{{ lt('mailbox.description') }}</dt>
            <dd class="wrap-anywhere">{{ item.description }}</dd>
          </div>
          <div>
            <dt class="font-medium">{{ t('filters.columns.type') }}</dt>
            <dd>{{ t(`filters.kind.${item.kind}`) }}</dd>
          </div>
          <div>
            <dt class="font-medium">{{ lt('mailbox.active') }}</dt>
            <dd>{{ lt(item.active ? 'mailbox.active' : 'mailbox.inactive') }}</dd>
          </div>
        </dl>
        <ScriptBlock :script="item.script" />
      </template>
    </template>
  </section>
</template>
