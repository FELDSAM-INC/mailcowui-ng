<script setup lang="ts">
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
import { buttonVariants } from '@/shared/ui/button'

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
  <li class="surface flex flex-col gap-3">
    <div class="min-w-0">
      <h2 class="font-semibold wrap-anywhere text-gray-900 dark:text-white">{{ name }}</h2>
      <p v-if="showDescription" class="text-sm wrap-anywhere text-gray-700 dark:text-gray-300">
        {{ passkey.authenticatorDescription }}
      </p>
      <p class="text-sm text-gray-700 dark:text-gray-300">
        {{ t('passkeys.registered') }} <DateTime :value="passkey.registeredAt" format="date" />
      </p>
    </div>
    <p v-if="otherHost" class="flex gap-2 text-sm text-gray-800 dark:text-gray-200">
      <InfoIcon class="mt-0.5 size-4 shrink-0" />
      <span class="min-w-0 wrap-anywhere">{{ t('passkeys.otherHost', { host: otherHost }) }}</span>
    </p>
    <p v-if="!passkey.active" class="flex gap-2 text-sm text-warning-800 dark:text-warning-200">
      <WarningIcon class="mt-0.5 size-4 shrink-0" />
      <span>{{ t('passkeys.inactive') }}</span>
    </p>
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        @click="$emit('rename', passkey)"
      >
        {{ lt('fido2.rename') }}<span class="sr-only">{{ ` ${name}` }}</span>
      </button>
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline', class: 'text-red-700 dark:text-red-300' })"
        @click="$emit('remove', passkey)"
      >
        {{ lt('user.remove') }}<span class="sr-only">{{ ` ${name}` }}</span>
      </button>
    </div>
  </li>
</template>
