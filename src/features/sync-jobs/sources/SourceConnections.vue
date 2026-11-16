<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { problemOf } from '@/api'
import { useIdentityQuery } from '@/app/session/queries'
import MailboxSearchPicker from '@/shared/components/MailboxSearchPicker.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { confirm } from '@/shared/composables/useConfirm'
import { buttonVariants } from '@/shared/ui/button'
import { SyncIcon } from '@/shared/icons'
import { connectionsOptions, disconnect, sourceKey, startConnection } from './api'
const props = defineProps<{ sourceId: number; mailbox?: string; allowSelect?: boolean }>()
const emit = defineEmits<{ select: [remote: string] }>()
const { t } = useI18n(),
  identity = useIdentityQuery(),
  client = useQueryClient()
const selectedOwner = ref(''),
  busy = ref(false),
  authorizationUrl = ref('')
const failure = ref<ReturnType<typeof problemOf>>(null)
const owner = computed(
  () =>
    props.mailbox ||
    (identity.data.value?.role === 'mailboxUser'
      ? identity.data.value.username
      : selectedOwner.value),
)
const query = useQuery(
  computed(() => ({
    ...connectionsOptions(props.sourceId, owner.value),
    enabled: !!owner.value,
    refetchOnWindowFocus: 'always' as const,
  })),
)
watch([owner, () => props.sourceId], () => {
  authorizationUrl.value = ''
  failure.value = null
})
async function connect() {
  if (!owner.value || busy.value) return
  busy.value = true
  failure.value = null
  authorizationUrl.value = ''
  try {
    authorizationUrl.value = (await startConnection(props.sourceId, owner.value)).authorizationUrl
  } catch (e) {
    failure.value = problemOf(e)
  } finally {
    busy.value = false
  }
}
async function remove(remoteUser: string) {
  if (
    busy.value ||
    !(await confirm({
      title: t('syncSources.disconnect'),
      description: t('syncSources.disconnectConfirm', { user: remoteUser }),
      confirmLabel: t('syncSources.disconnect'),
      destructive: true,
    }))
  )
    return
  busy.value = true
  failure.value = null
  try {
    await disconnect(props.sourceId, owner.value, remoteUser)
    await client.invalidateQueries({ queryKey: sourceKey })
  } catch (e) {
    failure.value = problemOf(e)
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <section class="space-y-3 border-t border-line pt-4">
    <h3 class="text-base font-semibold">{{ t('syncSources.connections') }}</h3>
    <MailboxSearchPicker
      v-if="!mailbox && identity.data.value?.role !== 'mailboxUser'"
      id="source-connection-owner"
      :label="t('syncSources.fields.mailbox')"
      :model-value="selectedOwner || null"
      @update:model-value="selectedOwner = typeof $event === 'string' ? $event : ''"
    />
    <p class="text-sm text-muted">{{ t('syncSources.connectionHelp') }}</p>
    <ProblemMessage :problem="failure ?? problemOf(query.error.value)" />
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        :disabled="busy || !owner"
        @click="connect"
      >
        {{ t('syncSources.connect') }}</button
      ><button
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        :disabled="query.isFetching.value || !owner"
        @click="query.refetch()"
      >
        <SyncIcon class="size-4" />{{ t('syncSources.refreshConnections') }}
      </button>
    </div>
    <a
      v-if="authorizationUrl"
      :href="authorizationUrl"
      target="_blank"
      rel="noopener noreferrer"
      :class="buttonVariants({})"
      >{{ t('syncSources.continueOAuth') }}</a
    >
    <ul v-if="query.data.value?.length" class="divide-y divide-line">
      <li
        v-for="connection in query.data.value"
        :key="connection.remoteUser"
        class="flex flex-wrap items-center justify-between gap-2 py-3"
      >
        <div class="min-w-0">
          <p class="wrap-anywhere">{{ connection.remoteUser }}</p>
          <p v-if="connection.refreshFailed" class="text-sm text-danger">
            {{ t('syncSources.refreshFailed') }}
          </p>
        </div>
        <div class="flex gap-2">
          <button
            v-if="allowSelect"
            type="button"
            :class="buttonVariants({ variant: 'outline', size: 'sm' })"
            @click="emit('select', connection.remoteUser)"
          >
            {{ t('syncSources.useAccount') }}</button
          ><button
            type="button"
            :class="buttonVariants({ variant: 'outline', size: 'sm' })"
            :disabled="busy"
            @click="remove(connection.remoteUser)"
          >
            {{ t('syncSources.disconnect') }}
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>
