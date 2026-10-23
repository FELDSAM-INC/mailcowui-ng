<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

// The ban list (FR-064 to FR-066, FR-070, plan decisions 2, 14, 16, 18 and 19), after the regex
// filters as legacy has it, without a heading: `admin.ban_list_info`, `admin.no_active_bans` when
// there are neither active nor permanent bans, the public ban list address with Copy and the
// refresh icon (a new address after a confirmation, as the contract marks it destructive), the
// active bans with unban, allowlist and denylist (denylisting confirmed, with the own-address
// warning), and the permanent bans as danger labels. Bans are read all at once, as legacy shows
// them; more than the largest page show legacy's count line.
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  ApiProblem,
  isApiProblem,
  problemOf,
  type Fail2BanSettings,
  type MonitoringCapabilities,
} from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { confirm } from '@/shared/composables/useConfirm'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'
import { CopyIcon } from '@/shared/icons'
import { copyText } from '@/shared/platform/clipboard'
import { buttonVariants } from '@/shared/ui/button'

import {
  activeBansOptions,
  applyBanResult,
  banAction,
  fetchSettings,
  permanentBansOptions,
  refreshBans,
  rotateBanListId,
  writeSettings,
  type BanAction,
} from '../api'
import { coversAddress } from '../covers-address'
import ActiveBanItem from './ActiveBanItem.vue'
import { RestartIcon } from '../../icons'

const props = defineProps<{
  settings: Fail2BanSettings
  capabilities: MonitoringCapabilities | null
}>()

const { t } = useI18n()
const fmt = useFormat()
const client = useQueryClient()

const active = useQuery(activeBansOptions())
const permanent = useQuery(permanentBansOptions())
const activeBans = computed(() => active.data.value?.data ?? [])
const permanentBans = computed(() => permanent.data.value?.data ?? [])
const loading = computed(() => active.isPending.value || permanent.isPending.value)
const none = computed(
  () =>
    !!active.data.value &&
    !!permanent.data.value &&
    activeBans.value.length === 0 &&
    permanentBans.value.length === 0,
)

const status = ref<string | null>(null)
const notRecorded = ref(false)
const problem = shallowRef<ApiProblem | null>(null)
const busy = ref(false)

function info(page: { data: unknown[]; meta: { total: number } } | undefined) {
  if (!page || page.meta.total <= page.data.length) return null
  return lt('datatables.info', {
    _START_: fmt.number(1),
    _END_: fmt.number(page.data.length),
    _TOTAL_: fmt.number(page.meta.total),
  })
}

async function run(network: string, action: BanAction) {
  status.value = null
  problem.value = null
  notRecorded.value = false
  if (action === 'denylist') {
    const address = props.capabilities?.clientAddress
    const ok = await confirm({
      title: t('operations.fail2ban.denylistTitle', { network }),
      ...(address && coversAddress(network, address)
        ? { description: t('operations.fail2ban.ownAddress', { address }) }
        : {}),
      confirmLabel: t('operations.fail2ban.denylist'),
      destructive: true,
    })
    if (!ok) return
  }
  busy.value = true
  try {
    const { result, auditRecorded } = await banAction(network, action)
    applyBanResult(client, result)
    notRecorded.value = !auditRecorded
    status.value = lt('success.object_modified', network)
    announce(status.value)
  } catch (error) {
    const current = isApiProblem(error)
      ? error
      : ApiProblem.fromParts({ kind: 'network', cause: error })
    if (current.status === 404) {
      status.value = null
      problem.value = null
      announce(t('operations.fail2ban.banEnded'))
      ended.value = network
      void refreshBans(client)
    } else {
      problem.value = current
    }
  } finally {
    busy.value = false
  }
}

const ended = ref<string | null>(null)

// The public ban list address (FR-070).
const copyStatus = ref<string | null>(null)
async function copy() {
  if (!props.settings.banListUrl) return
  const outcome = await copyText(props.settings.banListUrl)
  copyStatus.value =
    outcome === 'copied' ? lt('admin.copy_to_clipboard') : t('operations.copyRefused')
  announce(copyStatus.value)
}

const versioned = useVersionedSave<Fail2BanSettings>({
  current: () => props.settings,
  refetch: async () => {
    const latest = await fetchSettings()
    writeSettings(client, latest)
    return latest
  },
})

async function rotate() {
  status.value = null
  problem.value = null
  notRecorded.value = false
  const ask = () =>
    confirm({
      title: t('operations.fail2ban.rotate'),
      description: t('operations.fail2ban.rotateBody'),
      confirmLabel: lt('admin.refresh'),
      destructive: true,
    })
  if (!(await ask())) return
  const result = await versioned.remove((ifMatch) => rotateBanListId(ifMatch), ask)
  if (result.status === 'saved') {
    writeSettings(client, result.result.result)
    notRecorded.value = !result.result.auditRecorded
    status.value = lt('success.f2b_banlist_refreshed')
    announce(status.value)
  } else if (result.status === 'failed') {
    problem.value = result.problem
  }
}

function retry() {
  void active.refetch()
  void permanent.refetch()
}
</script>

<template>
  <div data-ban-list class="flex flex-col gap-3">
    <LegacyText k="admin.ban_list_info" as="p" class="text-sm text-gray-600 dark:text-gray-400" />
    <p v-if="none" data-no-bans>
      <i>{{ lt('admin.no_active_bans') }}</i>
    </p>

    <div class="flex items-stretch gap-2">
      <input
        :value="settings.banListUrl ?? ''"
        type="text"
        readonly
        data-ban-list-url
        :aria-label="t('operations.fail2ban.banlistUrl')"
        class="form-control min-w-0 flex-1 font-mono text-sm"
      />
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline', size: 'icon' })"
        :aria-label="t('operations.copy')"
        :disabled="!settings.banListUrl"
        @click="copy"
      >
        <CopyIcon />
      </button>
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline', size: 'icon' })"
        :aria-label="t('operations.fail2ban.rotate')"
        :disabled="versioned.pending.value"
        @click="rotate"
      >
        <RestartIcon />
      </button>
    </div>

    <p
      v-if="status"
      role="status"
      data-ban-status
      class="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
    >
      {{ status }}
    </p>
    <p
      v-if="ended"
      role="status"
      data-ban-ended
      class="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
    >
      {{ t('operations.fail2ban.banEnded') }}
    </p>
    <p
      v-if="notRecorded"
      role="status"
      class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      {{ t('operations.notRecorded') }}
    </p>
    <ProblemMessage :problem="problem" />

    <p v-if="loading" role="status">{{ lt('datatables.loadingRecords') }}</p>
    <ProblemMessage
      v-else-if="active.isError.value || permanent.isError.value"
      :problem="problemOf(active.error.value ?? permanent.error.value)"
      retry
      @retry="retry"
    />
    <template v-else>
      <ul
        v-if="activeBans.length > 0"
        data-active-bans
        class="flex flex-col divide-y divide-gray-200 dark:divide-gray-800"
      >
        <ActiveBanItem
          v-for="ban in activeBans"
          :key="ban.network"
          :ban="ban"
          :busy="busy"
          @action="(action) => run(ban.network, action)"
        />
      </ul>
      <p v-if="info(active.data.value)" class="text-sm text-gray-700 dark:text-gray-300">
        {{ info(active.data.value) }}
      </p>
      <hr class="border-gray-200 dark:border-gray-800" />
      <ul v-if="permanentBans.length > 0" data-permanent-bans class="flex flex-wrap gap-2">
        <li v-for="ban in permanentBans" :key="ban.network" class="max-w-full min-w-0">
          <Badge color="error">{{ ban.network }}</Badge>
        </li>
      </ul>
      <p v-if="info(permanent.data.value)" class="text-sm text-gray-700 dark:text-gray-300">
        {{ info(permanent.data.value) }}
      </p>
    </template>
  </div>
</template>
