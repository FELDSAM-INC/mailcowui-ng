<script setup lang="ts">
// The outcome of a section save that is not about a field (FR-003, FR-066, edge cases): a refused
// attribute names the attributes; a domain that is gone links back to the list; anything else says
// that nothing was saved and offers a retry that keeps the input.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { text } from '@/i18n'
import type { ApiProblem } from '@/api'
import { useProblemMessages } from '@/i18n/problems'
import { DangerIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { FIELD_LABEL_KEYS } from '../../field-labels'

const props = defineProps<{
  problem: ApiProblem | null
  listRoute?: string
  /** The "gone" text and the link back to the list, for templates. */
  goneKey?: string
  backKey?: string
}>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
const { problemMessage } = useProblemMessages()

const kind = computed(() => {
  if (!props.problem) return null
  if (props.problem.is('attribute-not-permitted')) return 'refused'
  if (props.problem.status === 404) return 'gone'
  return 'failed'
})
const message = computed(() =>
  props.problem
    ? problemMessage(props.problem, {
        labelFor: (name) => (FIELD_LABEL_KEYS[name] ? text(FIELD_LABEL_KEYS[name]) : name),
      })
    : '',
)
</script>

<template>
  <div
    v-if="problem"
    role="alert"
    class="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
  >
    <DangerIcon class="mt-0.5 size-5 shrink-0" />
    <div class="flex min-w-0 flex-col items-start gap-2">
      <template v-if="kind === 'gone'">
        <p class="break-words">{{ t(goneKey ?? 'domains.edit.gone') }}</p>
        <RouterLink :to="{ name: listRoute ?? 'domains' }" class="underline underline-offset-2">
          {{ t(backKey ?? 'domains.detail.backToList') }}
        </RouterLink>
      </template>
      <p v-else-if="kind === 'refused'" class="break-words">{{ message }}</p>
      <template v-else>
        <p class="break-words">{{ t('domains.edit.notSaved') }} {{ message }}</p>
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          @click="emit('retry')"
        >
          {{ t('common.retry') }}
        </button>
      </template>
    </div>
  </div>
</template>
