<script setup lang="ts">
import DataIdentity from './DataIdentity.vue'

// The mobile representation of a data-table row. Actions stay beside its identity; only
// secondary or lengthy values belong in the optional disclosure at the bottom.
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { ChevronDownIcon } from '@/shared/icons'

withDefaults(
  defineProps<{
    as?: 'li' | 'article' | 'div'
    title?: string
    to?: RouteLocationRaw | null
    titleId?: string
    detailsId?: string
    detailsLabel?: string
  }>(),
  {
    as: 'li',
    title: undefined,
    to: undefined,
    titleId: undefined,
    detailsId: undefined,
    detailsLabel: undefined,
  },
)
const expanded = defineModel<boolean>('expanded', { default: false })
const id = useId()
const { t } = useI18n()
</script>

<template>
  <component
    :is="as"
    data-card
    :aria-labelledby="titleId ?? `${id}-title`"
    class="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-sm text-ink"
  >
    <div data-card-header class="flex min-w-0 items-start gap-2">
      <div v-if="$slots.select" class="flex min-h-11 shrink-0 items-center">
        <slot name="select" />
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <!-- eslint-disable-next-line vuejs-accessibility/heading-has-content -- the title slot or prop supplies the heading. -->
        <DataIdentity
          ><h3
            :id="titleId ?? `${id}-title`"
            class="flex min-h-11 min-w-0 items-center text-base font-semibold wrap-anywhere"
          >
            <RouterLink
              v-if="to"
              :to="to"
              class="inline-flex min-h-11 min-w-0 max-w-full items-center wrap-anywhere underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <slot name="title">{{ title }}</slot>
            </RouterLink>
            <slot v-else name="title">{{ title }}</slot>
          </h3>
          <template v-if="$slots.badges" #badges><slot name="badges" /></template
        ></DataIdentity>
        <div v-if="$slots.subtitle" class="min-w-0 wrap-anywhere text-muted">
          <slot name="subtitle" />
        </div>
      </div>
      <div
        v-if="$slots.actions"
        data-card-actions
        class="flex shrink-0 items-start justify-end gap-1"
      >
        <slot name="actions" />
      </div>
    </div>
    <slot />
    <template v-if="$slots.details">
      <button
        type="button"
        data-card-expand
        class="inline-flex min-h-11 max-w-full items-center gap-2 self-start rounded-lg px-2 text-start font-medium text-accent-text hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
        :aria-expanded="expanded"
        :aria-controls="detailsId ?? `${id}-details`"
        :aria-label="
          detailsLabel ??
          (title ? t('domains.list.detailsOf', { name: title }) : t('domains.list.details'))
        "
        @click="expanded = !expanded"
      >
        <ChevronDownIcon
          class="size-4 shrink-0 motion-safe:transition-transform"
          :class="expanded ? 'rotate-180' : ''"
        />
        {{ t('domains.list.details') }}
      </button>
      <div
        v-if="expanded"
        :id="detailsId ?? `${id}-details`"
        data-card-details
        class="min-w-0 border-t border-line pt-3"
      >
        <slot name="details" />
      </div>
    </template>
  </component>
</template>
