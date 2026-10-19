<script setup lang="ts">
// One content part of a message as inert text (UI 006 FR-020, FR-021, research R9): legacy's
// heading, the text through PlainText (line breaks kept, long lines wrapped), "-" when the part is
// missing, and for a part over 20 lines or 4,000 characters its beginning with "Show full text" /
// "Show less", whose state is exposed (`aria-expanded`, `aria-controls`).
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import PlainText from '@/shared/components/PlainText.vue'
import { buttonVariants } from '@/shared/ui/button'

import { preview } from '../../content-preview'

const props = defineProps<{ heading: string; text: string | null; part: string }>()
const { t } = useI18n()
const id = useId()
const expanded = ref(false)
const view = computed(() => preview(props.text ?? ''))
const shown = computed(() =>
  expanded.value || !view.value.truncated ? (props.text ?? '') : view.value.head,
)
</script>

<template>
  <section :data-part="part" :aria-labelledby="`${id}-heading`" class="flex flex-col gap-2">
    <h2 :id="`${id}-heading`" class="text-lg font-semibold text-gray-900 dark:text-white">
      {{ heading }}
    </h2>
    <slot />
    <p v-if="text === null || text === ''" class="text-gray-900 dark:text-white">-</p>
    <template v-else>
      <div
        :id="`${id}-text`"
        data-text
        class="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-sm text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
      >
        <PlainText :value="shown" multiline />
      </div>
      <button
        v-if="view.truncated"
        type="button"
        :class="buttonVariants({ variant: 'outline', class: 'self-start' })"
        :aria-expanded="expanded ? 'true' : 'false'"
        :aria-controls="`${id}-text`"
        @click="expanded = !expanded"
      >
        {{ expanded ? t('quarantineUi.item.showLess') : t('quarantineUi.item.showFullText') }}
      </button>
    </template>
  </section>
</template>
