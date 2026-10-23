<script setup lang="ts">
import { useDataList } from '@/shared/composables/useDataList'

import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { isApiProblem, problemOf, type ApiProblem, type RecentLogin } from '@/api'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { lt } from '@/i18n'
import MailboxContextHeader from '../components/layout/MailboxContextHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { confirm } from '@/shared/composables/useConfirm'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { buttonVariants } from '@/shared/ui/button'
import { clearRecentLogins, useRecentLogins } from '../api/recent-logins'
import RecentLoginFilters from '../components/recent-logins/RecentLoginFilters.vue'
import RecentLoginList from '../components/recent-logins/RecentLoginList.vue'
import RecentLoginTable from '../components/recent-logins/RecentLoginTable.vue'
import { useSectionAccess } from '../composables/useSectionAccess'
import { useRecentLoginListState } from '../recent-login-list-state'
import { recentLoginPeriods } from '../recent-login-period'

const access = useSectionAccess(() => 'recentLogins')
const appAccess = useSectionAccess(() => 'appPasswords')
const mailbox = access.context.mailbox
const client = useQueryClient()
const wide = useMediaQuery('(min-width: 768px)')
const limits = access.capabilities.data.value?.recentLogins ?? {
  minDays: 1,
  maxDays: 31,
  defaultDays: 7,
}
const list = useRecentLoginListState(limits)
const query = useRecentLogins(mailbox, list.params)
const rows = computed(() => query.data.value?.data ?? [])
const total = computed(() => query.data.value?.meta.total ?? 0)
const changing = ref(false)
const problem = shallowRef<ApiProblem | null>(null)
const notFound = computed(() => isApiProblem(query.error.value) && query.error.value.status === 404)
let disposed = false
onScopeDispose(() => {
  disposed = true
})
function appPasswordLink(entry: RecentLogin) {
  const allowed =
    access.context.kind.value === 'own'
      ? appAccess.own.value === 'visible'
      : appAccess.mailbox.value.mode !== 'hidden'
  if (!allowed || !entry.appPassword?.name) return undefined
  return {
    name:
      access.context.kind.value === 'own'
        ? 'account-app-password-detail'
        : 'mailbox-app-password-detail',
    params: {
      appPasswordId: entry.appPassword.id,
      ...(access.context.kind.value === 'mailbox' ? { address: mailbox.value } : {}),
    },
  }
}
async function clear() {
  if (changing.value || !access.canChange.value) return
  const owner = mailbox.value
  if (
    !(await confirm({
      title: lt('user.clear_recent_successful_connections'),
      description: lt('user.delete_ays'),
      confirmLabel: lt('footer.delete_now'),
      destructive: true,
    }))
  )
    return
  if (disposed || owner !== mailbox.value || !access.canChange.value) return
  changing.value = true
  problem.value = null
  try {
    await clearRecentLogins(client, owner)
    if (!disposed) await list.setPage(1)
  } catch (error) {
    if (!disposed) problem.value = problemOf(error)
  } finally {
    changing.value = false
  }
}
watch([total, () => list.state.value.page], ([count, page]) => {
  if (count > 0 && (page - 1) * list.state.value.size >= count)
    void list.setPage(Math.ceil(count / list.state.value.size))
})

useDataList(
  'recent-logins',
  () => ({
    key: list.state.value.sort,
    order: list.state.value.order ?? 'asc',
    change: (key, order) =>
      void list.setSort(key as NonNullable<typeof list.state.value.sort>, order),
  }),
  () => ({ run: () => query.refetch(), pending: query.isFetching.value, disabled: false }),
)
</script>
<template>
  <NotFoundPage v-if="notFound" />
  <section v-else class="flex flex-col gap-5">
    <MailboxContextHeader :title="lt('user.recent_successful_connections')">
      <template #actions
        ><button
          v-if="access.canChange.value"
          type="button"
          :disabled="changing || !rows.length"
          :class="buttonVariants({ variant: 'outline' })"
          @click="clear"
        >
          {{ lt('user.clear_recent_successful_connections') }}
        </button></template
      >
    </MailboxContextHeader>
    <RecentLoginFilters :list="list" :periods="recentLoginPeriods(limits)" />
    <ProblemMessage v-if="problem" :problem="problem" />
    <p v-if="query.isPending.value" role="status" aria-busy="true">{{ lt('user.loading') }}</p>
    <ProblemMessage
      v-else-if="query.isError.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <p v-else-if="!rows.length" role="status">{{ lt('user.no_record') }}</p>
    <template v-else
      ><RecentLoginTable :hidden="!wide" :entries="rows" :app-password-link="appPasswordLink" />
      <RecentLoginList v-if="!wide" :entries="rows" :app-password-link="appPasswordLink"
    /></template>
    <PaginationBar
      :total="total"
      :page="list.state.value.page"
      :size="list.state.value.size"
      @update:page="list.setPage"
      @update:size="list.setSize($event as 25 | 50 | 100)"
    />
  </section>
</template>
