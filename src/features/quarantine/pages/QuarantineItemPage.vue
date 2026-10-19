<script setup lang="ts">
// A quarantine item (UI 006 US1, US2; FR-018 to FR-031, FR-036 to FR-038; research R13, R14),
// the classic item modal (`templates/modals/quarantine.twig`) as its own page: legacy's heading
// `quarantine.qitem` with the subject, then the fields in legacy's order (filter result, subject,
// recipients, From header, SMTP sender, the fields the API adds, fuzzy hashes, both text parts,
// attachments), and the actions in a bar at the bottom. Every message value is inert text. The
// flags decide the actions; what they deny is named with legacy's "Prohibited by ACL". An item
// that does not exist or lies outside the scope shows the not-found page with a way back. After
// an action, or when the item turns out to be gone, the user returns to the list in its previous
// state (Back when the list is the previous entry) with legacy's alerts.
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, nextTick, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import {
  isApiProblem,
  problemOf,
  queryKeys,
  reportSessionProblem,
  type ApiProblem,
  type PermissionFlags,
  type QuarantineAttachment,
} from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { lt } from '@/i18n'
import AclReadOnlyNote from '@/shared/components/AclReadOnlyNote.vue'
import PlainText from '@/shared/components/PlainText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { ChevronLeftIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import type { OutcomeLine } from '../action-outcome'
import { forgetItem, quarantineItemOptions } from '../api'
import { useQuarantineCapabilities } from '../capabilities'
import ActionOutcomeMessage from '../components/ActionOutcomeMessage.vue'
import AttachmentList from '../components/item/AttachmentList.vue'
import FilterResult from '../components/item/FilterResult.vue'
import FuzzyHashes from '../components/item/FuzzyHashes.vue'
import ItemActionBar, { type ItemBarAction } from '../components/item/ItemActionBar.vue'
import ItemFields from '../components/item/ItemFields.vue'
import MessageContent from '../components/item/MessageContent.vue'
import { useItemAction, type RereadResult } from '../composables/useItemAction'
import { saveAttachment, saveMessage } from '../downloads'
import { setQuarantineFlash } from '../flash'
import { canActOnItems, canDownloadMessage, missingFlag } from '../permissions'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const client = useQueryClient()
const identityQuery = useIdentityQuery()
const identity = computed(() => identityQuery.data.value ?? null)
const capabilities = useQuarantineCapabilities()

const itemId = computed(() => Number(route.params.itemId))
const query = useQuery(computed(() => quarantineItemOptions(itemId.value)))
const item = computed(() => query.data.value)
const notFound = computed(
  () => !item.value && isApiProblem(query.error.value) && query.error.value.status === 404,
)

const scoped = computed(() => !!identity.value && identity.value.role !== 'mailboxUser')
const canAct = computed(() => canActOnItems(identity.value))
const canDownload = computed(
  () => canDownloadMessage(identity.value) && item.value?.contentStatus === 'available',
)
/** The flags whose absence the page names: actions, then the whole-message download. */
const deniedFlags = computed(() => {
  const flags = [
    missingFlag(identity.value, 'actOnItems'),
    missingFlag(identity.value, 'downloadMessage'),
  ].filter((flag): flag is keyof PermissionFlags => flag !== null)
  return [...new Set(flags)]
})

/** Back to the list as it was: Back when the list is the previous entry, otherwise the list. */
function backToList() {
  const previous = router.options.history.state.back
  if (typeof previous === 'string' && router.resolve(previous).name === 'quarantine') {
    router.back()
  } else void router.push({ name: 'quarantine' })
}

function leave(lines: OutcomeLine[]) {
  setQuarantineFlash(lines)
  backToList()
}

async function reread(): Promise<RereadResult> {
  try {
    await client.fetchQuery({ ...quarantineItemOptions(itemId.value), staleTime: 0 })
    return 'present'
  } catch (error) {
    return isApiProblem(error) && error.status === 404 ? 'gone' : 'failed'
  }
}

const action = useItemAction({
  item: () => item.value,
  reread,
  onFinished: leave,
  onGone(lines) {
    void forgetItem(client, itemId.value)
    leave(lines)
  },
})

// Downloads (FR-036 to FR-038): saved as files; a refusal is shown here, and a refused flag
// refreshes the identity and the item (the session reaction, FR-004).
const downloading = ref(false)
const downloadProblem = shallowRef<ApiProblem | null>(null)
async function download(attachment?: QuarantineAttachment) {
  const current = item.value
  if (!current || downloading.value) return
  downloadProblem.value = null
  downloading.value = true
  try {
    if (attachment) await saveAttachment(current, attachment)
    else await saveMessage(current)
  } catch (error) {
    const problem = problemOf(error)!
    downloadProblem.value = problem
    reportSessionProblem(problem)
    if (problem.status === 403) {
      void client.invalidateQueries({ queryKey: queryKeys.quarantine.detail(itemId.value) })
    }
  } finally {
    downloading.value = false
  }
}

/** Lets a menu close and return the focus to its trigger before a confirmation opens. */
function onAction(choice: ItemBarAction) {
  void nextTick(() =>
    requestAnimationFrame(() => {
      if (choice === 'download') void download()
      else void action.run(choice)
    }),
  )
}

const busy = computed(() => action.sending.value || downloading.value)
</script>

<template>
  <NotFoundPage
    v-if="notFound"
    :back-to="{ name: 'quarantine' }"
    :back-label="t('lists.backToList')"
  />
  <article
    v-else
    class="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-5"
    :data-item="item?.id"
    :data-page-loading="!item && query.isPending.value ? '' : undefined"
  >
    <button
      type="button"
      data-back-to-list
      :class="buttonVariants({ variant: 'ghost', class: 'self-start' })"
      @click="backToList"
    >
      <ChevronLeftIcon class="size-4 rtl:rotate-180" />
      {{ t('lists.backToList') }}
    </button>
    <header class="flex min-w-0 flex-col gap-1">
      <h1
        tabindex="-1"
        class="text-2xl font-semibold wrap-anywhere text-gray-900 focus:outline-none dark:text-white"
      >
        {{ lt('quarantine.qitem') }}
      </h1>
      <p
        v-if="item"
        data-item-subject
        class="text-lg wrap-anywhere text-gray-700 dark:text-gray-300"
      >
        <PlainText :value="(item.content?.subject ?? item.subject) || '-'" />
      </p>
    </header>

    <div v-if="!item && query.isPending.value" role="status" aria-busy="true">
      <p class="text-gray-600 dark:text-gray-400">{{ lt('datatables.loadingRecords') }}</p>
    </div>

    <div v-else-if="!item" class="flex flex-col gap-3">
      <p role="alert" class="font-medium text-gray-900 dark:text-white">
        {{ t('quarantineUi.item.loadError') }}
      </p>
      <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
    </div>

    <template v-else>
      <AclReadOnlyNote
        v-for="flag in deniedFlags"
        :id="`qitem-acl-${flag}`"
        :key="flag"
        :flag="flag"
      />
      <ActionOutcomeMessage :lines="action.lines.value" @dismiss="action.dismiss()" />
      <button
        v-if="action.retryKind.value"
        type="button"
        data-retry
        :class="buttonVariants({ variant: 'outline', class: 'self-start' })"
        :disabled="busy"
        @click="action.retry()"
      >
        {{ t('common.retry') }}
      </button>
      <ProblemMessage :problem="downloadProblem" />

      <FilterResult :item="item" />
      <ItemFields :item="item" :scoped="scoped" />
      <FuzzyHashes :hashes="item.fuzzyHashes" />
      <MessageContent :item="item" :limit="capabilities.data.value?.contentSizeLimit ?? null" />
      <AttachmentList
        v-if="item.content?.attachments"
        :attachments="item.content.attachments"
        :busy="busy"
        @download="download"
      />

      <ItemActionBar
        :can-act="canAct"
        :can-download="canDownload"
        :busy="busy"
        @action="onAction"
      />
    </template>
  </article>
</template>
