<script setup lang="ts">
// A section of a detail page with its own edit and save (conventions "Editing and conflicts",
// UI 001 R20, UI 002 research D11, FR-029 to FR-038). The parent owns the state: it opens and
// closes the section through `editing`, and decides when a save may run.
// - Read-only values are the default slot, shown as text (never as disabled inputs).
// - Below md the open section takes the full width with a sticky action bar (FR-069); from md up
//   it opens in place. Opening moves the focus to its heading (FR-075).
// - Status messages are inline and stay until the parent clears them (FR-067).
// - After an outdated save, the changed fields are listed with their new saved values, with
//   "Save again" and "Discard my changes" (FR-037). Nothing is merged or sent on its own.
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import { useMediaQuery } from '../composables/useMediaQuery'
import { CheckIcon, InfoIcon, WarningIcon } from '../icons'
import { buttonVariants } from '../ui/button'
import type { SectionChange, SectionStatus } from './editable-section'
import { useStickyBarFocus } from '../composables/useStickyBarFocus'

const props = withDefaults(
  defineProps<{
    sectionId: string
    title: string
    editable: boolean
    editing: boolean
    /** Why Edit is unavailable right now, for example while another section is open. */
    editDisabledReason?: string | null
    saving?: boolean
    status?: SectionStatus | null
    outdated?: readonly SectionChange[] | null
    /** A version can change even when none of this section’s fields changed. */
    versionChanged?: boolean
    saveLabel?: string
    /** False when nothing in the open form can be saved any more: only Close is offered. */
    canSave?: boolean
  }>(),
  {
    editDisabledReason: null,
    saving: false,
    status: null,
    outdated: null,
    versionChanged: false,
    saveLabel: undefined,
    canSave: true,
  },
)
const emit = defineEmits<{ edit: []; cancel: []; save: []; saveAgain: []; discard: [] }>()

const { t } = useI18n()
const wide = useMediaQuery('(min-width: 768px)')
const heading = ref<HTMLElement | null>(null)
const root = ref<HTMLElement | null>(null)
const headingId = computed(() => `section-${props.sectionId}-title`)
const reasonId = computed(() => `section-${props.sectionId}-reason`)
const isOutdated = computed(() => props.versionChanged || (props.outdated?.length ?? 0) > 0)
const layout = computed(() => (props.editing && !wide.value ? 'full' : 'inline'))

watch(
  () => props.editing,
  async (editing) => {
    const hadFocus = !editing && root.value?.contains(document.activeElement)
    await nextTick()
    // Opening moves the focus to the heading; closing does too when the focus was in the form,
    // which is gone now, so that it never falls back to the page (UI 004, FR-062).
    if (editing || (hadFocus && !root.value?.contains(document.activeElement))) {
      heading.value?.focus()
    }
  },
)

function onEdit() {
  if (props.editDisabledReason) return
  emit('edit')
}

function onSubmit(event: Event) {
  event.preventDefault()
  if (props.saving || !props.canSave) return
  if (isOutdated.value) emit('saveAgain')
  else emit('save')
}

useStickyBarFocus()
</script>

<template>
  <section
    :id="`section-${sectionId}`"
    ref="root"
    :aria-labelledby="headingId"
    :data-layout="layout"
    class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
    :class="layout === 'full' ? '-mx-4 rounded-none border-x-0 sm:mx-0' : ''"
  >
    <div class="flex flex-wrap items-center gap-2">
      <h2
        :id="headingId"
        ref="heading"
        tabindex="-1"
        class="me-auto text-lg font-semibold break-words text-gray-900 focus:outline-none dark:text-white"
      >
        {{ title }}
      </h2>
      <slot name="header-actions" />
      <template v-if="editable && !editing">
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline', size: 'sm' })"
          :aria-label="t('sections.editNamed', { section: title })"
          :aria-disabled="editDisabledReason ? 'true' : undefined"
          :aria-describedby="editDisabledReason ? reasonId : undefined"
          :data-disabled="editDisabledReason ? '' : undefined"
          class="data-disabled:cursor-not-allowed data-disabled:opacity-60"
          @click="onEdit"
        >
          {{ t('sections.edit') }}
        </button>
        <span v-if="editDisabledReason" :id="reasonId" class="sr-only">{{
          editDisabledReason
        }}</span>
      </template>
    </div>

    <div
      v-if="status"
      :role="status.kind === 'error' ? 'alert' : 'status'"
      class="mt-3 flex gap-2 rounded-xl border p-3 text-sm"
      :class="
        status.kind === 'error'
          ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
          : 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200'
      "
    >
      <CheckIcon v-if="status.kind === 'success'" class="mt-0.5 size-4 shrink-0" />
      <InfoIcon v-else class="mt-0.5 size-4 shrink-0" />
      <p class="break-words">{{ status.message }}</p>
    </div>

    <div v-if="!editing" class="mt-3">
      <slot />
    </div>

    <form v-else class="mt-4 flex flex-col gap-4" novalidate @submit="onSubmit">
      <div
        v-if="isOutdated"
        data-outdated
        role="alert"
        class="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        <WarningIcon class="mt-0.5 size-5 shrink-0" />
        <div class="min-w-0">
          <p class="font-semibold">{{ t('sections.outdated.title') }}</p>
          <p class="mt-1 text-sm">
            {{ t(outdated?.length ? 'sections.outdated.body' : 'problem.status.412') }}
          </p>
          <ul v-if="outdated?.length" class="mt-2 list-disc ps-5 text-sm">
            <li v-for="change in outdated" :key="change.field" class="break-words">
              {{ t('sections.outdated.savedAs', { field: change.label, value: change.saved }) }}
            </li>
          </ul>
        </div>
      </div>

      <slot name="form" />

      <div
        data-section-actions
        class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
        :class="
          layout === 'full'
            ? 'sticky bottom-0 z-10 -mx-4 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900'
            : ''
        "
      >
        <button
          v-if="!canSave"
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          @click="emit('cancel')"
        >
          {{ t('common.close') }}
        </button>
        <template v-else-if="isOutdated">
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            :disabled="saving"
            @click="emit('discard')"
          >
            {{ t('sections.discard') }}
          </button>
          <button type="submit" :class="buttonVariants({ variant: 'default' })" :disabled="saving">
            {{ saving ? t('sections.saving') : t('sections.saveAgain') }}
          </button>
        </template>
        <template v-else>
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            :disabled="saving"
            @click="emit('cancel')"
          >
            {{ lt('footer.cancel') }}
          </button>
          <button type="submit" :class="buttonVariants({ variant: 'default' })" :disabled="saving">
            {{ saving ? t('sections.saving') : (saveLabel ?? t('sections.save')) }}
          </button>
        </template>
      </div>
    </form>
  </section>
</template>
