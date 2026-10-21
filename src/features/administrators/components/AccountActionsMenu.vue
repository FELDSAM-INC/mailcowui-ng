<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { SignInAsAction } from '@/features/acting'
import { lt } from '@/i18n'
import RowActions from '@/shared/components/RowActions.vue'
import RowAction from '@/shared/components/RowAction.vue'
import type { ManagedAccount } from '../api'

defineProps<{
  account: ManagedAccount
  detailTo?: string
  own?: boolean
  lastActive?: boolean
  busy?: boolean
}>()
const emit = defineEmits<{
  action: [action: 'activate' | 'deactivate' | 'suspendSecondFactors' | 'delete']
}>()
const { t } = useI18n()
</script>

<template>
  <RowActions
    v-slot="{ menu }"
    :count="2 + Number(!!detailTo) + Number(account.secondFactorStatus === 'active')"
    :label="t('lists.actionsFor', { name: account.username })"
    :disabled="busy"
  >
    <RowAction v-if="detailTo" :menu="menu" :to="detailTo" :label="lt('admin.edit')" />
    <RowAction
      :menu="menu"
      :label="lt(account.active ? 'mailbox.deactivate' : 'mailbox.activate')"
      :disabled="account.active && lastActive"
      @select="emit('action', account.active ? 'deactivate' : 'activate')"
    >
      <span class="flex flex-col">
        <span>{{ lt(account.active ? 'mailbox.deactivate' : 'mailbox.activate') }}</span>
        <span v-if="account.active && lastActive" class="text-xs">{{
          lt('warning.no_active_admin')
        }}</span>
      </span>
    </RowAction>
    <RowAction
      v-if="account.secondFactorStatus === 'active'"
      :menu="menu"
      :label="lt('tfa.disable_tfa')"
      @select="emit('action', 'suspendSecondFactors')"
    />
    <SignInAsAction
      v-if="'domains' in account"
      :menu="menu"
      :target="{ kind: 'domainAdmin', username: account.username }"
    />
    <slot />
    <RowAction
      :menu="menu"
      :label="lt('admin.remove')"
      destructive
      :disabled="own || lastActive"
      @select="emit('action', 'delete')"
    >
      <span class="flex flex-col">
        <span>{{ lt('admin.remove') }}</span>
        <span v-if="own || lastActive" class="text-xs">{{
          lt(own ? 'warning.cannot_delete_self' : 'warning.no_active_admin')
        }}</span>
      </span>
    </RowAction>
  </RowActions>
</template>
