<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useIdentityQuery } from '@/app/session/queries'
import { canSignInAs, SignInAsAction } from '@/features/acting'
import { lt } from '@/i18n'
import RowActions from '@/shared/components/RowActions.vue'
import RowAction from '@/shared/components/RowAction.vue'
import { PencilIcon, TrashIcon } from '@/shared/icons'
import { readableAddress, type Mailbox } from '../../types'

const props = withDefaults(defineProps<{ mailbox: Mailbox; removable?: boolean }>(), {
  removable: false,
})
const emit = defineEmits<{ remove: [mailbox: Mailbox, trigger: HTMLElement] }>()
const { t } = useI18n()
const identity = useIdentityQuery()
const target = computed(() => ({
  kind: 'mailboxUser' as const,
  address: props.mailbox.address,
  domain: props.mailbox.domain,
}))
const count = computed(
  () => 1 + Number(props.removable) + Number(canSignInAs(identity.data.value, target.value)),
)
</script>

<template>
  <RowActions
    v-slot="{ menu }"
    :count="count"
    :label="t('lists.actionsFor', { name: readableAddress(mailbox) })"
  >
    <RowAction
      :menu="menu"
      :to="{ name: 'mailbox-detail', params: { address: mailbox.address } }"
      :label="`${lt('mailbox.edit')} ${readableAddress(mailbox)}`"
    >
      <PencilIcon />{{ lt('mailbox.edit') }}
    </RowAction>
    <SignInAsAction :target="target" :menu="menu" />
    <RowAction
      v-if="removable"
      :menu="menu"
      destructive
      :label="`${lt('mailbox.remove')} ${readableAddress(mailbox)}`"
      @select="emit('remove', mailbox, $event)"
    >
      <TrashIcon />{{ lt('mailbox.remove') }}
    </RowAction>
  </RowActions>
</template>
