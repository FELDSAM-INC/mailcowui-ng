<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { TemporaryAlias } from '@/api'
import NoAccessState from '@/app/states/NoAccessState.vue'
import SettingsPage from '@/shared/components/SettingsPage.vue'
import MailboxContextHeader from '../components/layout/MailboxContextHeader.vue'
import GenerateAliasPanel from '../components/temporary-aliases/GenerateAliasPanel.vue'
import { useTemporaryAliasContext } from '../composables/useTemporaryAliasContext'

const { t } = useI18n()
const router = useRouter()
const { access, mailbox, location } = useTemporaryAliasContext()
function created(item: TemporaryAlias) {
  void router.replace({ ...location('list'), query: { q: item.address } })
}
</script>

<template>
  <SettingsPage>
    <template #header
      ><MailboxContextHeader :title="t('account.temporaryAliases.create')"
    /></template>
    <NoAccessState v-if="!access.canChange.value" />
    <GenerateAliasPanel
      v-else
      :key="mailbox"
      :mailbox="mailbox"
      :can-change="access.canChange.value"
      @created="created"
    />
  </SettingsPage>
</template>
