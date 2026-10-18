<script setup lang="ts">
// The "Goto address" of an alias (FR-012, FR-016): the destination addresses in readable form, the
// first two plus "+N more" in lists, all of them on the alias page; or the special action as text
// with legacy's labels (`add.goto_null`, `mailbox.goto_spam`, `mailbox.goto_ham`), never by icon
// or colour alone (FR-063).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Alias } from '@/api'
import type { LegacyKey } from '@/i18n'
import { useFormat } from '@/i18n/format'
import LegacyText from '@/shared/components/LegacyText.vue'

const props = withDefaults(defineProps<{ alias: Alias; full?: boolean }>(), { full: false })
const { t } = useI18n()
const format = useFormat()

const ACTIONS: Record<Exclude<Alias['destinationType'], 'addresses'>, LegacyKey> = {
  discard: 'add.goto_null',
  learnSpam: 'mailbox.goto_spam',
  learnHam: 'mailbox.goto_ham',
}

const shown = computed(() =>
  props.full ? props.alias.destinationsUnicode : props.alias.destinationsUnicode.slice(0, 2),
)
const more = computed(() => props.alias.destinationsUnicode.length - shown.value.length)
</script>

<template>
  <LegacyText
    v-if="alias.destinationType !== 'addresses'"
    :k="ACTIONS[alias.destinationType]"
    data-special-action
    class="font-medium"
  />
  <ul v-else class="flex min-w-0 flex-col gap-0.5">
    <li v-for="(destination, index) in shown" :key="index" class="break-all">{{ destination }}</li>
    <li v-if="more > 0" class="text-gray-600 dark:text-gray-400">
      {{ t('aliases.list.moreDestinations', { count: format.number(more) }) }}
    </li>
  </ul>
</template>
