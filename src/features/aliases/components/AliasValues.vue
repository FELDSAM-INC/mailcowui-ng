<script setup lang="ts">
// The values of the classic "Edit alias" form (`templates/edit/alias.twig`) in its order, shown
// read-only when the section is closed: address, goto addresses or the special action, SOGo visible
// (only with the groupware), internal, allowed to send, the private and public comment, active.
import type { Alias } from '@/api'
import { lt } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'

import { YesNoMark } from '@/features/aliases-common'

import AddressText from './AddressText.vue'
import DestinationSummary from './DestinationSummary.vue'

defineProps<{ alias: Alias; groupwareEnabled: boolean | undefined }>()
const DT = 'text-sm text-gray-600 dark:text-gray-400'
const DD = 'min-w-0 break-words text-gray-900 dark:text-white'
</script>

<template>
  <dl class="grid grid-cols-1 gap-3 md:grid-cols-[minmax(10rem,auto)_1fr] md:gap-x-6">
    <dt :class="DT">{{ lt('edit.alias') }}</dt>
    <dd :class="DD">
      <AddressText :address="alias.address" :address-unicode="alias.addressUnicode" />
    </dd>
    <dt :class="DT"><LegacyText k="edit.target_address" /></dt>
    <dd :class="DD" data-field="destinations"><DestinationSummary :alias="alias" full /></dd>
    <template v-if="groupwareEnabled">
      <dt :class="DT">{{ lt('edit.sogo_visible') }}</dt>
      <dd :class="DD"><YesNoMark :value="alias.groupwareVisible" /></dd>
    </template>
    <dt :class="DT">{{ lt('edit.internal') }}</dt>
    <dd :class="DD"><YesNoMark :value="alias.internal" /></dd>
    <dt :class="DT">{{ lt('edit.sender_allowed') }}</dt>
    <dd :class="DD"><YesNoMark :value="alias.senderAllowed" /></dd>
    <dt :class="DT">{{ lt('edit.private_comment') }}</dt>
    <dd :class="DD" data-field="privateComment">{{ alias.privateComment || '-' }}</dd>
    <dt :class="DT">{{ lt('edit.public_comment') }}</dt>
    <dd :class="DD" data-field="publicComment">{{ alias.publicComment || '-' }}</dd>
    <dt :class="DT">{{ lt('edit.active') }}</dt>
    <dd :class="DD"><YesNoMark :value="alias.active" /></dd>
  </dl>
</template>
