<script setup lang="ts">
import type { MailboxMailSettingsPatch } from '@/api'
import { lt } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'
import ChoiceButton from '@/shared/components/ChoiceButton.vue'
defineProps<{ inbound: boolean; outbound: boolean; pending: boolean; showWarning: boolean }>()
defineEmits<{ change: [patch: MailboxMailSettingsPatch] }>()
</script>
<template>
  <fieldset
    id="tls-policy"
    class="flex min-w-0 flex-col gap-3"
    :disabled="pending"
    :aria-busy="pending"
  >
    <legend class="mb-3 font-semibold">{{ lt('user.tls_policy') }}</legend>
    <div class="flex flex-wrap gap-2">
      <ChoiceButton
        data-tls="inbound"
        :pressed="inbound"
        :disabled="pending"
        @click="$emit('change', { tlsEnforceInbound: !inbound })"
      >
        {{ lt('user.tls_enforce_in') }}
      </ChoiceButton>
      <ChoiceButton
        data-tls="outbound"
        :pressed="outbound"
        :disabled="pending"
        @click="$emit('change', { tlsEnforceOutbound: !outbound })"
      >
        {{ lt('user.tls_enforce_out') }}
      </ChoiceButton>
    </div>
    <LegacyText v-if="showWarning" data-tls-warning k="user.tls_policy_warning" as="div" />
  </fieldset>
</template>
