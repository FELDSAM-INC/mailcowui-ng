<script setup lang="ts">
// The "Passkeys" page of every role (FR-051–FR-057): add a passkey, the list newest first with its
// pages, rename and remove. Only the signed-in account's passkeys exist here (FR-057). Removal is
// confirmed with the passkey's name and its consequence; after a 412 it is confirmed again against
// the reloaded passkey (conventions).
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { isApiProblem, queryKeys, type ApiProblem, type Passkey } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import ListState from '@/shared/components/ListState.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import PaginationBar from '@/shared/components/PaginationBar.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useConfirm } from '@/shared/composables/useConfirm'
import { useListState } from '@/shared/composables/useListState'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'

import { passkeysListQuery, removePasskey } from '../api'
import AddPasskeyForm from '../components/AddPasskeyForm.vue'
import PasskeyList from '../components/PasskeyList.vue'
import RenamePasskeyDialog from '../components/RenamePasskeyDialog.vue'
import { passkeyDisplayName } from '../display-name'

const { t } = useI18n()
const fmt = useFormat()
const confirm = useConfirm()
const queryClient = useQueryClient()
const list = useListState({ filters: {} })
const query = useQuery(
  computed(() =>
    passkeysListQuery({ limit: list.paging.value.limit, offset: list.paging.value.offset }),
  ),
)
const passkeys = computed(() => query.data.value?.data ?? [])
const total = computed(() => query.data.value?.meta.total ?? 0)
const removeProblem = ref<ApiProblem | null>(null)

const renaming = ref<string | null>(null)
const renameOpen = ref(false)
const renamed = computed(() => passkeys.value.find((passkey) => passkey.id === renaming.value))

const displayName = (passkey: Passkey) =>
  passkeyDisplayName(passkey, t, (value) => fmt.dateTime(value, 'date'))

async function reload(id: string): Promise<Passkey | undefined> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.passkeys.all() })
  const result = await query.refetch()
  return result.data?.data.find((passkey) => passkey.id === id)
}

function rename(passkey: Passkey) {
  renaming.value = passkey.id
  renameOpen.value = true
}

function removal(passkey: Passkey) {
  const last = total.value === 1
  return {
    title: t('passkeys.remove.title', { name: displayName(passkey) }),
    description: [t('passkeys.remove.body'), last ? t('passkeys.remove.last') : '']
      .filter(Boolean)
      .join(' '),
    confirmLabel: lt('user.remove'),
    destructive: true,
  }
}

async function remove(passkey: Passkey) {
  removeProblem.value = null
  if (!(await confirm(removal(passkey)))) return
  let target: Passkey | undefined = passkey
  const saver = useVersionedSave<Passkey>({
    current: () => target,
    refetch: async () => (target = await reload(passkey.id)),
  })
  const result = await saver.remove(
    (ifMatch) => removePasskey(passkey.id, ifMatch),
    async (latest) => (latest ? confirm(removal(latest)) : false),
  )
  if (result.status === 'saved') {
    announce(t('passkeys.removed'))
    await queryClient.invalidateQueries({ queryKey: queryKeys.passkeys.all() })
  } else if (result.status === 'failed') {
    removeProblem.value = isApiProblem(result.problem) ? result.problem : null
  }
}
</script>

<template>
  <section class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <PageHeader :title="t('passkeys.title')" :description="t('passkeys.intro')" />
    <AddPasskeyForm @added="query.refetch()" />
    <ProblemMessage :problem="removeProblem" />
    <ListState
      :loading="query.isPending.value"
      :empty="total === 0"
      :problem="isApiProblem(query.error.value) ? query.error.value : null"
      :empty-text="t('passkeys.empty')"
      @retry="query.refetch()"
    >
      <PasskeyList :passkeys="passkeys" :total="total" @rename="rename" @remove="remove" />
      <PaginationBar
        v-if="total > list.state.value.size"
        class="mt-4"
        :total="total"
        :page="list.state.value.page"
        :size="list.state.value.size"
        @update:page="list.setPage"
        @update:size="(size) => list.setSize(size as 25 | 50 | 100)"
      />
    </ListState>
    <RenamePasskeyDialog
      v-if="renamed"
      v-model:open="renameOpen"
      :passkey="renamed"
      :reload="() => reload(renamed!.id)"
      @saved="query.refetch()"
    />
  </section>
</template>
