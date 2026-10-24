<script setup lang="ts">
import type { MailboxTaggedMailHandling } from '@/api'
import { lt } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'
import ChoiceButton from '@/shared/components/ChoiceButton.vue'
defineProps<{ value: MailboxTaggedMailHandling; pending: boolean }>()
defineEmits<{ change: [value: MailboxTaggedMailHandling] }>()
const options = [
  { value: 'subfolder', key: 'user.tag_in_subfolder' },
  { value: 'subject', key: 'user.tag_in_subject' },
  { value: 'none', key: 'user.tag_in_none' },
] as const
</script>
<template>
  <fieldset
    id="tagged-mail"
    class="flex min-w-0 flex-col gap-3"
    :disabled="pending"
    :aria-busy="pending"
  >
    <legend class="mb-3 font-semibold">{{ lt('user.tag_handling') }}</legend>
    <div class="flex flex-wrap gap-2">
      <ChoiceButton
        v-for="option in options"
        :key="option.value"
        :data-value="option.value"
        :pressed="value === option.value"
        :disabled="pending"
        @click="$emit('change', option.value)"
      >
        {{ lt(option.key) }}
      </ChoiceButton>
    </div>
    <LegacyText k="user.tag_help_explain" as="div" />
    <LegacyText k="user.tag_help_example" as="div" />
  </fieldset>
</template>
