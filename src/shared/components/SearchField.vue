<script setup lang="ts">
// A list's search field (UI 004 research R7, FR-010): it searches when the form is submitted, at
// once, or after a pause in typing (500 ms by default), and offers a clear action. The parent owns
// the value in the page address and announces the result count after the list reloads.
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { CloseIcon } from '../icons'
import { buttonVariants } from '../ui/button'
import { SEARCH_MAX_LENGTH } from '../validation/limits'

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    modelValue: string
    description?: string
    delay?: number
    maxLength?: number
  }>(),
  { description: undefined, delay: 500, maxLength: SEARCH_MAX_LENGTH },
)
const emit = defineEmits<{ search: [value: string] }>()
const { t } = useI18n()

const value = ref(props.modelValue)
let timer: ReturnType<typeof setTimeout> | undefined

// The address changed elsewhere (Back, "clear all"): the field follows it.
watch(
  () => props.modelValue,
  (next) => {
    if (next !== value.value.trim()) value.value = next
  },
)

function stop() {
  if (timer) clearTimeout(timer)
  timer = undefined
}

function onInput(event: Event) {
  value.value = (event.target as HTMLInputElement).value
  stop()
  timer = setTimeout(() => {
    timer = undefined
    emit('search', value.value.trim())
  }, props.delay)
}

function submit(event: Event) {
  event.preventDefault()
  stop()
  emit('search', value.value.trim())
}

function clear() {
  stop()
  value.value = ''
  emit('search', '')
}

onBeforeUnmount(stop)
</script>

<template>
  <form
    role="search"
    class="flex flex-col gap-1.5"
    :aria-labelledby="`${id}-label`"
    @submit="submit"
  >
    <label
      :id="`${id}-label`"
      :for="id"
      class="text-sm font-medium text-gray-800 dark:text-gray-200"
    >
      {{ label }}
    </label>
    <div class="flex gap-2">
      <input
        :id="id"
        type="search"
        :value="value"
        :maxlength="maxLength"
        autocomplete="off"
        autocapitalize="none"
        autocorrect="off"
        spellcheck="false"
        enterkeyhint="search"
        :aria-describedby="description ? `${id}-description` : undefined"
        class="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        @input="onInput"
      />
      <button
        v-if="value !== ''"
        type="button"
        :class="buttonVariants({ variant: 'outline', size: 'icon' })"
        :aria-label="t('lists.search.clear')"
        @click="clear"
      >
        <CloseIcon />
      </button>
    </div>
    <p
      v-if="description"
      :id="`${id}-description`"
      class="text-sm text-gray-600 dark:text-gray-400"
    >
      {{ description }}
    </p>
  </form>
</template>
