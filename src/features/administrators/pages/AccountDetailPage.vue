<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { isApiProblem, problemOf, type DomainAdmin } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { lt } from '@/i18n'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { activeAdminCountOptions, useAccount, type AccountRole, type ManagedAccount } from '../api'
import { SignInAsAction } from '@/features/acting'
import AccountActionsMenu from '../components/AccountActionsMenu.vue'
import AccountSection from '../components/AccountSection.vue'
import PermissionsSection from '../components/PermissionsSection.vue'
import { takeAccountFlash, setAccountFlash } from '../flash'
import { handleOwnAccountSave } from '../own-account'
import { useAccountActions } from '../useAccountActions'
const props = defineProps<{ role: AccountRole }>()
const { t } = useI18n(),
  route = useRoute(),
  router = useRouter(),
  identity = useIdentityQuery()
const username = computed(() => String(route.params.username ?? '')),
  query = useAccount(() => props.role, username),
  account = computed(() => query.data.value)
const count = useQuery(
  computed(() => ({ ...activeAdminCountOptions(), enabled: props.role === 'admin' })),
)
const allowed = computed(
  () => identity.data.value?.role === 'admin' && !isApiProblem(query.error.value),
)
const own = computed(
  () => props.role === 'admin' && account.value?.username === identity.data.value?.username,
)
const lastActive = computed(
  () => props.role === 'admin' && !!account.value?.active && (count.data.value ?? 1) <= 1,
)
const listName = computed(() => (props.role === 'admin' ? 'admins' : 'domain-admins'))
const editing = computed(() =>
  route.query.edit === 'account' ||
  (props.role === 'domainAdmin' && route.query.edit === 'permissions')
    ? route.query.edit
    : null,
)
const dirty = ref(false),
  wide = useMediaQuery('(min-width: 768px)')
const guard = useLeaveGuard(dirty, 'leaveGuard.body')
onBeforeRouteUpdate(async (to, from) => {
  if (to.path === from.path && to.query.edit !== from.query.edit && dirty.value) return guard.ask()
  return true
})
const actions = useAccountActions({
  role: () => props.role,
  allowed: () => allowed.value,
  ownUsername: () => identity.data.value?.username ?? '',
  activeAdminCount: () => count.data.value ?? 1,
  context: () => route.fullPath,
})
const flash = ref<string | null>(null)
watch(
  username,
  (value) => {
    dirty.value = false
    flash.value = takeAccountFlash(value)
    if (flash.value) announce(flash.value)
  },
  { immediate: true },
)
function open(section: string) {
  void router.push({ query: { ...route.query, edit: section } })
}
async function close() {
  if (dirty.value && !(await guard.ask())) return
  dirty.value = false
  const next = { ...route.query }
  delete next.edit
  void router.replace({ query: next })
}
function reason(section: string) {
  return editing.value && editing.value !== section
    ? t('sections.editDisabled', {
        section:
          editing.value === 'permissions'
            ? t('administrators.permissions.title')
            : lt(props.role === 'admin' ? 'edit.admin' : 'edit.domain_admin'),
      })
    : null
}
async function saved(item: ManagedAccount, before?: ManagedAccount) {
  dirty.value = false
  if (
    props.role === 'admin' &&
    before &&
    (await handleOwnAccountSave(before, item, identity.data.value?.username ?? ''))
  )
    return
  if (item.username !== username.value) {
    setAccountFlash(
      item.username,
      props.role === 'admin'
        ? lt('success.admin_modified')
        : lt('success.domain_admin_modified', item.username),
    )
    await router.replace({
      name: props.role === 'admin' ? 'admin-detail' : 'domain-admin-detail',
      params: { username: item.username },
    })
    return
  }
  await close()
}
async function action(name: 'activate' | 'deactivate' | 'suspendSecondFactors' | 'delete') {
  if (!account.value) return
  const result = await actions.run(name, account.value)
  if (result === 'done' && name === 'delete') {
    guard.disarm()
    setAccountFlash('', actions.notice.value ?? '')
    await router.push({ name: listName.value })
  } else if (result === 'failed' && actions.problem.value?.status === 412) await query.refetch()
}
</script>
<template>
  <NotFoundPage
    v-if="isApiProblem(query.error.value) && query.error.value.status === 404"
    :back-to="{ name: listName }"
    :back-label="t('accounts.backToList')"
  />
  <div v-else-if="!account && query.isPending.value" role="status" aria-busy="true">
    {{ lt('datatables.loadingRecords') }}
  </div>
  <ProblemMessage
    v-else-if="!account"
    :problem="problemOf(query.error.value)"
    retry
    @retry="query.refetch()"
  />
  <section v-else class="mx-auto flex w-full max-w-5xl flex-col gap-4">
    <RouterLink
      :to="{ name: listName }"
      class="inline-flex min-h-11 items-center self-start underline underline-offset-4"
      >{{ t('accounts.backToList') }}</RouterLink
    >
    <PageHeader
      :title="lt(role === 'admin' ? 'edit.admin' : 'edit.domain_admin')"
      :description="account.username"
      ><template #actions
        ><HistoryLink
          :target-type="role"
          :target-id="account.username"
          :allowed="allowed" /><SignInAsAction
          v-if="role === 'domainAdmin' && !editing"
          :target="{ kind: 'domainAdmin', username: account.username }" /><AccountActionsMenu
          v-if="allowed"
          :account="account"
          :own="own"
          :last-active="lastActive"
          :busy="actions.pending.value || !!editing"
          @action="action" /></template
    ></PageHeader>
    <p
      v-if="flash"
      role="status"
      class="rounded-xl border border-green-200 bg-green-50 p-3 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
    >
      {{ flash }}
    </p>
    <p v-if="actions.notice.value" role="status">{{ actions.notice.value }}</p>
    <ProblemMessage :problem="actions.problem.value ?? problemOf(query.error.value)" />
    <AccountSection
      v-if="wide || !editing || editing === 'account'"
      :key="`account-${role}-${username}`"
      :account="account"
      :role="role"
      :editing="editing === 'account'"
      :editable="allowed"
      :own="own"
      :last-active="lastActive"
      :edit-disabled-reason="reason('account')"
      @edit="open('account')"
      @cancel="close"
      @saved="saved"
      @dirty="dirty = $event"
      @suspend="action('suspendSecondFactors')"
    />
    <PermissionsSection
      v-if="role === 'domainAdmin' && (wide || !editing || editing === 'permissions')"
      :key="`permissions-${username}`"
      :account="account as DomainAdmin"
      :editing="editing === 'permissions'"
      :editable="allowed"
      :edit-disabled-reason="reason('permissions')"
      @edit="open('permissions')"
      @cancel="close"
      @saved="saved"
      @dirty="dirty = $event"
    />
  </section>
</template>
