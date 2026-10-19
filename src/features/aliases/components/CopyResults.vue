<script setup lang="ts">
// The outcomes of "Expand alias over alias domains" (FR-032, research R12; legacy form map part 2):
// one line per alias domain with the message legacy gives for it — the created copy with
// `success.alias_added`, linked to it; a copy skipped because the address is in use
// (`danger.is_alias_or_mailbox`), the alias limit (`danger.max_alias_exceeded`) or a refused
// external destination (`danger.external_goto_denied`); a failure with its problem's message. A
// domain without alias domains creates nothing, which is said.
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { ApiProblem, type AliasCopyOutcome } from '@/api'
import { lt } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import { CheckIcon, DangerIcon, InfoIcon } from '@/shared/icons'

defineProps<{ copies: readonly AliasCopyOutcome[] }>()
const { t } = useI18n()
const { problemMessage } = useProblemMessages()

function text(copy: AliasCopyOutcome): string {
  if (copy.outcome === 'created') return lt('success.alias_added', copy.address, copy.aliasId ?? '')
  if (copy.outcome === 'failed' && copy.problem) {
    const { type, status, requestId, ...extensions } = copy.problem
    return problemMessage(
      ApiProblem.fromParts({ kind: 'problem', type, status, requestId, extensions }),
    )
  }
  switch (copy.reason) {
    case 'addressInUse':
      return lt('danger.is_alias_or_mailbox', copy.address)
    case 'aliasLimitReached':
      return lt('danger.max_alias_exceeded')
    case 'destinationNotPermitted':
      return lt('danger.external_goto_denied', copy.address)
    default:
      return `${copy.addressUnicode}: ${t(`bulk.outcome.${copy.outcome === 'failed' ? 'failed' : 'skipped'}`)}`
  }
}
</script>

<template>
  <div data-copy-results class="text-sm">
    <p v-if="copies.length === 0" class="text-gray-700 dark:text-gray-300">
      {{ t('aliases.copy.none') }}
    </p>
    <ul v-else class="flex flex-col gap-1">
      <li
        v-for="copy in copies"
        :key="copy.aliasDomain"
        :data-copy="copy.outcome"
        class="flex min-w-0 gap-2"
      >
        <CheckIcon
          v-if="copy.outcome === 'created'"
          class="mt-0.5 size-4 shrink-0 text-green-700 dark:text-green-400"
        />
        <DangerIcon
          v-else-if="copy.outcome === 'failed'"
          class="mt-0.5 size-4 shrink-0 text-red-700 dark:text-red-400"
        />
        <InfoIcon v-else class="mt-0.5 size-4 shrink-0 text-gray-600 dark:text-gray-400" />
        <RouterLink
          v-if="copy.outcome === 'created' && copy.aliasId !== null"
          :to="{ name: 'alias-detail', params: { aliasId: copy.aliasId } }"
          class="min-w-0 break-words text-gray-900 underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white"
          >{{ text(copy) }}</RouterLink
        >
        <span v-else class="min-w-0 break-words text-gray-900 dark:text-white">{{
          text(copy)
        }}</span>
      </li>
    </ul>
  </div>
</template>
