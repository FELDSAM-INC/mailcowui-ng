<script setup lang="ts">
// Message headers and symbol options are untrusted and can be as large as the message itself.
// Bound their initial DOM work like the body preview; expansion keeps the complete inert value.
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import PlainText from '@/shared/components/PlainText.vue'
import { buttonVariants } from '@/shared/ui/button'

import { preview } from '../../content-preview'

const props = defineProps<{ value: string }>()
const { t } = useI18n()
const id = useId()
const expanded = ref(false)
const view = computed(() => preview(props.value))
watch(
  () => props.value,
  () => {
    expanded.value = false
  },
)
</script>

<template>
  <span class="inline-flex max-w-full min-w-0 flex-col items-start gap-1">
    <span :id="id" class="min-w-0 max-w-full">
      <PlainText :value="expanded ? value : view.head" />
    </span>
    <button
      v-if="view.truncated"
      type="button"
      :class="buttonVariants({ variant: 'outline', class: 'text-sm' })"
      :aria-expanded="expanded ? 'true' : 'false'"
      :aria-controls="id"
      @click="expanded = !expanded"
    >
      {{ expanded ? t('quarantineUi.item.showLess') : t('quarantineUi.item.showFullText') }}
    </button>
  </span>
</template>
