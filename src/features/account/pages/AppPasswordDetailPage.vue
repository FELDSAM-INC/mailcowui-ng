<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import { isApiProblem, problemOf } from '@/api'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { lt } from '@/i18n'
import MailboxContextHeader from '../components/layout/MailboxContextHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import OneTimeSecretDialog from '@/shared/components/OneTimeSecretDialog.vue'
import { confirm } from '@/shared/composables/useConfirm'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { buttonVariants } from '@/shared/ui/button'
import { afterAppPasswordChange, regenerateAppPassword, useAppPassword } from '../api/app-passwords'
import AppPasswordForm from '../components/app-passwords/AppPasswordForm.vue'
import { useAppPasswordContext } from '../composables/useAppPasswordContext'
import { APP_PASSWORD_PROTOCOL_ORDER, appPasswordProtocolListKey } from '../labels'
const { t } = useI18n()
const route = useRoute()
const client = useQueryClient()
const { access, mailbox, location } = useAppPasswordContext()
const id = computed(() => Number(route.params.appPasswordId))
const query = useAppPassword(mailbox, id)
const item = computed(() => query.data.value)
const protocolText = computed(() => {
  const protocols = item.value?.protocols ?? []
  return (
    APP_PASSWORD_PROTOCOL_ORDER.filter((p) => protocols.includes(p))
      .map((p) => t(appPasswordProtocolListKey(p)))
      .join(', ') || '–'
  )
})
const notFound = computed(() => isApiProblem(query.error.value) && query.error.value.status === 404)
const request = useSecretRequest(regenerateAppPassword)
const secret = ref<string | null>(null)
const dialog = ref<{ requestClose(): Promise<boolean> } | null>(null)
const outdated = ref(false)
let disposed = false
let generation = 0
watch(
  [mailbox, id],
  () => {
    generation++
    request.clear()
  },
  { flush: 'sync' },
)
onScopeDispose(() => {
  disposed = true
  secret.value = null
})
async function regenerate() {
  const current = item.value
  if (!current || !access.canChange.value || request.pending.value) return
  const owner = mailbox.value
  const objectId = current.id
  const startedGeneration = generation
  const currentContext = () =>
    !disposed &&
    generation === startedGeneration &&
    mailbox.value === owner &&
    id.value === objectId
  if (
    !(await confirm({
      title: lt('edit.generate'),
      description: t('account.appPasswords.regenerate.body'),
      confirmLabel: lt('edit.generate'),
    }))
  )
    return
  if (!currentContext() || !access.canChange.value || request.pending.value) return
  const value = await request.run(owner, objectId, current.etag)
  if (!currentContext()) {
    if (value && !disposed) afterAppPasswordChange(client, value)
    request.clear()
    return
  }
  if (value) {
    afterAppPasswordChange(client, value)
    secret.value = value.generatedPassword
    request.clear()
    outdated.value = false
  } else if (request.problem.value?.status === 412) {
    outdated.value = true
    await query.refetch()
  }
}
onBeforeRouteLeave(() => dialog.value?.requestClose() ?? true)
onBeforeRouteUpdate(() => dialog.value?.requestClose() ?? true)
</script>
<template>
  <NotFoundPage v-if="notFound" :back-to="location('list')" :back-label="lt('user.app_passwds')" />
  <section v-else class="flex flex-col gap-5">
    <MailboxContextHeader
      :title="`${lt('edit.app_passwd')}${item ? `: ${item.name}` : ''}`"
      target-type="appPassword"
    />
    <p
      v-if="query.isPending.value"
      role="status"
      aria-busy="true"
      class="text-gray-700 dark:text-gray-300"
    >
      {{ lt('datatables.loadingRecords') }}
    </p>
    <ProblemMessage
      v-else-if="query.isError.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <template v-else-if="item">
      <AppPasswordForm
        v-if="access.canChange.value"
        :key="`${mailbox}/${item.id}`"
        :mailbox="mailbox"
        :stored="item"
        can-change
        @saved="outdated = false"
      />
      <dl v-else class="grid gap-3 text-gray-800 dark:text-gray-200">
        <div>
          <dt class="font-medium">{{ lt('edit.app_name') }}</dt>
          <dd class="wrap-anywhere">{{ item.name }}</dd>
        </div>
        <div>
          <dt class="font-medium">{{ lt('edit.active') }}</dt>
          <dd>{{ lt(item.active ? 'mailbox.active' : 'mailbox.inactive') }}</dd>
        </div>
        <div>
          <dt class="font-medium">{{ lt('edit.app_passwd_protocols') }}</dt>
          <dd>
            {{ protocolText }}
          </dd>
        </div>
      </dl>
      <p v-if="outdated" role="alert" data-outdated class="text-amber-900 dark:text-amber-200">
        {{ t('sections.outdated.title') }} {{ t('sections.outdated.body') }}
      </p>
      <ProblemMessage
        v-if="request.problem.value?.status !== 412"
        :problem="request.problem.value"
      />
      <button
        v-if="access.canChange.value"
        type="button"
        :disabled="request.pending.value"
        :class="buttonVariants({ variant: 'outline', class: 'self-start' })"
        @click="regenerate"
      >
        {{ lt('edit.generate') }}
      </button>
    </template>
    <OneTimeSecretDialog
      ref="dialog"
      :secret="secret"
      :title="lt('edit.app_passwd')"
      :username="mailbox"
      grouped
      @close="secret = null"
    />
  </section>
</template>
