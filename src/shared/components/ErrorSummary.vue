<script setup lang="ts">
// The error summary of a form with more than one error (FR-076): a list of in-page links to the
// fields. It receives focus when shown (useProblemForm).
import { useI18n } from 'vue-i18n'

import type { SummaryItem } from '../composables/useProblemForm'

const props = defineProps<{ id: string; items: readonly SummaryItem[] }>()
const { t } = useI18n()

function focusField(event: MouseEvent, fieldId: string) {
  const field = document.getElementById(fieldId)
  if (!field) return
  event.preventDefault()
  field.focus()
  field.scrollIntoView?.({ block: 'center' })
}
defineExpose({ props })
</script>

<template>
  <div
    v-if="items.length > 1"
    :id="id"
    tabindex="-1"
    :aria-labelledby="`${id}-title`"
    class="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 focus:outline-2 focus:outline-offset-2 focus:outline-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
  >
    <h2 :id="`${id}-title`" class="font-semibold">{{ t('forms.errorSummary.title') }}</h2>
    <ul class="mt-2 list-disc ps-5">
      <li v-for="item in items" :key="item.path">
        <a
          :href="`#${item.fieldId}`"
          class="underline underline-offset-2"
          @click="focusField($event, item.fieldId)"
        >
          {{ item.messages.join(' ') }}
        </a>
      </li>
    </ul>
  </div>
</template>
