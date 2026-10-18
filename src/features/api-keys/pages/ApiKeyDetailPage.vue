<script setup lang="ts">
// One API key (FR-067, FR-068, US7-AS4, AS5): every attribute, the note that keys cannot be edited,
// and "Revoke" with a confirmation that names the key and its consequences. Revocation sends the
// version tag that was read; a key changed elsewhere is reloaded and the user may try again. A key
// revoked meanwhile revokes again without change and shows its current state.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { ApiProblem } from '@/api'
import DateTime from '@/shared/components/DateTime.vue'
import ListState from '@/shared/components/ListState.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useConfirm } from '@/shared/composables/useConfirm'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'
import { ChevronLeftIcon, InfoIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { queryProblem, rememberRevokedKey, revokeApiKey, useApiKey } from '../api'
import ApiKeyStatusBadge from '../components/ApiKeyStatusBadge.vue'
import LastUse from '../components/LastUse.vue'
import OwnerSummary from '../components/OwnerSummary.vue'

const props = defineProps<{ apiKeyId: string }>()
const { t } = useI18n()
const confirm = useConfirm()
const queryClient = useQueryClient()
const query = useApiKey(() => props.apiKeyId)
const key = computed(() => query.data.value)
const loadProblem = computed(() => queryProblem(query.error.value))
const notFound = computed(() => loadProblem.value?.status === 404)
const problem = shallowRef<ApiProblem | null>(null)

const versioned = useVersionedSave({
  current: () => key.value,
  refetch: async () => (await query.refetch()).data,
})

async function revoke() {
  const current = key.value
  if (!current) return
  const confirmed = await confirm({
    title: t('apiKeys.revoke.title', { name: current.name }),
    description: t('apiKeys.revoke.body'),
    confirmLabel: t('apiKeys.revoke.action'),
    destructive: true,
  })
  if (!confirmed) return
  problem.value = null
  const result = await versioned.save(current.id, (id, ifMatch) => revokeApiKey(id, ifMatch))
  if (result.status === 'saved') {
    rememberRevokedKey(queryClient, result.result)
    announce(t('apiKeys.revoke.done'))
  } else if (result.status === 'outdated') {
    // The key was reloaded; the message says so and the user may revoke again.
    problem.value = ApiProblem.fromParts({ kind: 'problem', status: 412 })
  } else if (result.status === 'failed') {
    problem.value = result.problem
  }
}

const term = 'font-medium text-gray-600 dark:text-gray-400'
const definition = 'mb-3 wrap-anywhere text-gray-900 sm:mb-0 dark:text-white'
</script>

<template>
  <section class="mx-auto flex w-full max-w-4xl flex-col gap-6">
    <RouterLink :to="{ name: 'api-keys' }" class="text-link gap-1 self-start">
      <ChevronLeftIcon class="size-4" />{{ t('apiKeys.detail.back') }}
    </RouterLink>

    <template v-if="notFound">
      <PageHeader :title="t('apiKeys.detail.notFound.title')" />
      <p class="text-gray-700 dark:text-gray-300">{{ t('apiKeys.detail.notFound.body') }}</p>
    </template>

    <ListState
      v-else
      :loading="query.isPending.value"
      :empty="false"
      :problem="loadProblem"
      @retry="query.refetch()"
    >
      <template v-if="key">
        <PageHeader :title="key.name">
          <template v-if="key.status !== 'revoked'" #actions>
            <button
              type="button"
              :class="buttonVariants({ variant: 'destructive' })"
              :disabled="versioned.pending.value"
              @click="revoke"
            >
              {{ t('apiKeys.revoke.action') }}
            </button>
          </template>
        </PageHeader>
        <ProblemMessage :problem="problem" />
        <div class="surface">
          <dl
            class="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[minmax(8rem,auto)_1fr] sm:gap-y-3"
          >
            <dt :class="term">{{ t('apiKeys.fields.status') }}</dt>
            <dd :class="definition"><ApiKeyStatusBadge :status="key.status" /></dd>
            <dt :class="term">{{ t('apiKeys.fields.prefix') }}</dt>
            <dd :class="definition" class="font-mono">{{ key.prefix }}</dd>
            <dt :class="term">{{ t('apiKeys.fields.owner') }}</dt>
            <dd :class="definition"><OwnerSummary :owner="key.owner" /></dd>
            <dt :class="term">{{ t('apiKeys.fields.access') }}</dt>
            <dd :class="definition">{{ t(`enums.apiKeyAccessLevel.${key.accessLevel}`) }}</dd>
            <dt :class="term">{{ t('apiKeys.fields.allowedNetworks') }}</dt>
            <dd :class="definition">
              <ul v-if="key.allowedNetworks.length > 0" class="flex flex-col font-mono">
                <li v-for="network in key.allowedNetworks" :key="network">{{ network }}</li>
              </ul>
              <template v-else>{{ t('apiKeys.anyAddress') }}</template>
            </dd>
            <dt :class="term">{{ t('apiKeys.fields.expires') }}</dt>
            <dd :class="definition">
              <DateTime v-if="key.expiresAt" :value="key.expiresAt" />
              <template v-else>{{ t('apiKeys.neverExpires') }}</template>
            </dd>
            <dt :class="term">{{ t('apiKeys.fields.created') }}</dt>
            <dd :class="definition"><DateTime :value="key.createdAt" /></dd>
            <dt :class="term">{{ t('apiKeys.fields.createdBy') }}</dt>
            <dd :class="definition">{{ key.createdBy.username }}</dd>
            <dt :class="term">{{ t('apiKeys.fields.lastUsed') }}</dt>
            <dd :class="definition"><LastUse :api-key="key" /></dd>
            <template v-if="key.revokedAt">
              <dt :class="term">{{ t('apiKeys.fields.revoked') }}</dt>
              <dd :class="definition"><DateTime :value="key.revokedAt" /></dd>
              <dt :class="term">{{ t('apiKeys.fields.revokedBy') }}</dt>
              <dd :class="definition">{{ key.revokedBy?.username ?? '' }}</dd>
            </template>
          </dl>
        </div>
        <div
          class="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        >
          <InfoIcon class="mt-0.5 size-5 shrink-0" />
          <p>{{ t('apiKeys.detail.notEditable') }}</p>
        </div>
      </template>
    </ListState>
  </section>
</template>
