<script setup lang="ts">
// A list's filter panel (UI 006 plan P24, research R12, FR-013; created at its third use after UI
// 002's and UI 003's feature-local panels, whose look it keeps). The toggle names the number of
// active filters. From md up the fields sit in an inline panel below the toggle; below md the
// toggle opens a full-screen dialog (Reka, so focus stays inside and returns to the toggle). The
// fields are the parent's (default slot) and work on a draft: "Apply filters" applies the draft in
// one step, "Clear all filters" removes every filter. `open` tells the parent to start the draft
// from the applied filters. In the dialog both actions close it; Escape closes without applying.
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMediaQuery } from '../composables/useMediaQuery'
import { FilterIcon } from '../icons'
import { buttonVariants } from '../ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '../ui/dialog'

const props = withDefaults(
  defineProps<{
    /** The inline panel's ID (`aria-controls`); the dialog's parts derive theirs from it. */
    id: string
    activeCount: number
    /** The draft is invalid: Apply stays disabled (the fields show why). */
    applyDisabled?: boolean
  }>(),
  { applyDisabled: false },
)
const emit = defineEmits<{ open: []; apply: []; clear: [] }>()
const { t } = useI18n()
const wide = useMediaQuery('(min-width: 768px)')

const expanded = ref(props.activeCount > 0)
const dialogOpen = ref(false)

const label = () =>
  props.activeCount > 0
    ? t('lists.filters.withCount', { count: props.activeCount })
    : t('lists.filters.title')

function toggleInline() {
  expanded.value = !expanded.value
  if (expanded.value) emit('open')
}

watch(dialogOpen, (open) => {
  if (open) emit('open')
})
// Crossing the breakpoint closes the dialog; the inline panel keeps its state.
watch(wide, (isWide) => {
  if (isWide) dialogOpen.value = false
})

function apply() {
  if (props.applyDisabled) return
  emit('apply')
  dialogOpen.value = false
}

function clear() {
  emit('clear')
  dialogOpen.value = false
}

const toggleClass = () =>
  buttonVariants({ variant: props.activeCount > 0 ? 'default' : 'outline', class: 'self-start' })
</script>

<template>
  <div class="flex min-w-0 flex-col gap-3">
    <template v-if="wide">
      <button
        type="button"
        data-filter-toggle
        :class="toggleClass()"
        :aria-expanded="expanded ? 'true' : 'false'"
        :aria-controls="id"
        @click="toggleInline"
      >
        <FilterIcon />
        {{ label() }}
      </button>
      <form
        v-show="expanded"
        :id="id"
        data-filter-panel
        novalidate
        class="flex min-w-0 flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        @submit.prevent="apply"
      >
        <div class="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <slot />
        </div>
        <div class="flex flex-wrap gap-3">
          <button
            type="submit"
            :class="buttonVariants({ variant: 'default' })"
            :disabled="applyDisabled"
          >
            {{ t('lists.filters.apply') }}
          </button>
          <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="clear">
            {{ t('lists.filters.clear') }}
          </button>
        </div>
      </form>
    </template>
    <Dialog v-else v-model:open="dialogOpen">
      <DialogTrigger as-child>
        <button type="button" data-filter-toggle :class="toggleClass()" aria-haspopup="dialog">
          <FilterIcon />
          {{ label() }}
        </button>
      </DialogTrigger>
      <DialogContent full-screen :aria-describedby="undefined" class="justify-start gap-4 p-4">
        <DialogTitle class="pe-14 text-xl">{{ t('lists.filters.title') }}</DialogTitle>
        <form
          :id="`${id}-dialog`"
          data-filter-panel
          novalidate
          class="flex min-w-0 flex-1 flex-col gap-4"
          @submit.prevent="apply"
        >
          <div class="flex min-w-0 flex-col gap-4">
            <slot />
          </div>
          <div
            class="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-3 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-[#1E2635]"
          >
            <button
              type="submit"
              :class="buttonVariants({ variant: 'default' })"
              :disabled="applyDisabled"
            >
              {{ t('lists.filters.apply') }}
            </button>
            <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="clear">
              {{ t('lists.filters.clear') }}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
