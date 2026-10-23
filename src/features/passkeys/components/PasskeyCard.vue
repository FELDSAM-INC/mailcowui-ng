<script setup lang="ts">
import DataCard from '@/shared/components/DataCard.vue'
import DataCardFields from '@/shared/components/DataCardFields.vue'
import RowAction from '@/shared/components/RowAction.vue'
import RowActions from '@/shared/components/RowActions.vue'

// One passkey (FR-052): its display name, the authenticator, the registration date, and notes in
// text when it is bound to another host or inactive (FR-084). Rename and remove are offered for
// every passkey, also on devices without passkey support (FR-056).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Passkey } from '@/api'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import DateTime from '@/shared/components/DateTime.vue'
import { InfoIcon, WarningIcon } from '@/shared/icons'

import { passkeyDisplayName } from '../display-name'

const props = defineProps<{ passkey: Passkey }>()
defineEmits<{ rename: [passkey: Passkey]; remove: [passkey: Passkey] }>()
const { t } = useI18n()
const fmt = useFormat()
const name = computed(() =>
  passkeyDisplayName(props.passkey, t, (value) => fmt.dateTime(value, 'date')),
)
const showDescription = computed(
  () =>
    !!props.passkey.authenticatorDescription &&
    name.value !== props.passkey.authenticatorDescription,
)
const otherHost = computed(() =>
  props.passkey.hostName && props.passkey.hostName !== globalThis.location?.hostname
    ? props.passkey.hostName
    : null,
)
</script>

<template>
  <DataCard :title="name">
    <template v-if="showDescription" #subtitle>{{ passkey.authenticatorDescription }}</template>
    <template #actions>
      <RowActions v-slot="{ menu }" :count="2" :label="t('lists.actionsFor', { name })">
        <RowAction
          :menu="menu"
          :label="`${lt('fido2.rename')} ${name}`"
          @select="$emit('rename', passkey)"
        >
          {{ lt('fido2.rename') }}
        </RowAction>
        <RowAction
          :menu="menu"
          destructive
          :label="`${lt('user.remove')} ${name}`"
          @select="$emit('remove', passkey)"
        >
          {{ lt('user.remove') }}
        </RowAction>
      </RowActions>
    </template>
    <DataCardFields>
      <div>
        <dt>{{ t('passkeys.registered') }}</dt>
        <dd><DateTime :value="passkey.registeredAt" format="date" /></dd>
      </div>
    </DataCardFields>
    <p v-if="otherHost" class="flex gap-2 text-sm text-gray-800 dark:text-gray-200">
      <InfoIcon class="mt-0.5 size-4 shrink-0" />
      <span class="min-w-0 wrap-anywhere">{{ t('passkeys.otherHost', { host: otherHost }) }}</span>
    </p>
    <p v-if="!passkey.active" class="flex gap-2 text-sm text-warning-800 dark:text-warning-200">
      <WarningIcon class="mt-0.5 size-4 shrink-0" />
      <span>{{ t('passkeys.inactive') }}</span>
    </p>
  </DataCard>
</template>
