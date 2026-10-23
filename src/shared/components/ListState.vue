<script setup lang="ts">
// The loading, empty and error states of a collection (constitution II, FR-089), with the classic
// interface's DataTables texts for loading and for an empty table. The default slot is the
// content, shown when the collection has entries.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ApiProblem } from '@/api'
import { lt } from '@/i18n'
import { buttonVariants } from '@/shared/ui/button'

import ProblemMessage from './ProblemMessage.vue'

const props = withDefaults(
  defineProps<{
    loading: boolean
    empty: boolean
    problem: ApiProblem | null
    emptyText?: string
    errorText?: string
    /** Explicit initial failure; false allows stale rows to remain visible during a refresh error. */
    failed?: boolean
    refreshFailed?: boolean
    refreshText?: string
    skeleton?: 24 | 28 | 32 | 40
    noMatches?: boolean
    clearLabel?: string
    emptyLayout?: 'centered' | 'actions' | 'plain' | 'compact' | 'centered-actions'
    emptyAttrs?: Record<string, string>
    noMatchesAttrs?: Record<string, string>
    errorAttrs?: Record<string, string>
    retryPlacement?: 'problem' | 'separate'
  }>(),
  { failed: undefined, emptyLayout: 'centered', retryPlacement: 'problem' },
)
defineEmits<{ retry: []; clear: [] }>()

const { t } = useI18n()
const skeletonClasses = { 24: 'h-24', 28: 'h-28', 32: 'h-32', 40: 'h-40' }
const emptyContainerClass = computed(() =>
  props.emptyLayout === 'centered-actions'
    ? 'flex flex-col items-center gap-3 py-8 text-center text-gray-600 dark:text-gray-400'
    : props.emptyLayout === 'compact'
      ? 'flex flex-col items-start gap-3 py-2'
      : 'flex flex-col items-start gap-3 py-6',
)
const emptyTextClass = computed(() =>
  props.emptyLayout === 'centered-actions'
    ? undefined
    : props.emptyLayout === 'compact'
      ? 'text-sm text-gray-700 dark:text-gray-300'
      : 'text-gray-700 dark:text-gray-300',
)
</script>

<template>
  <slot v-if="loading" name="loading">
    <div
      v-if="skeleton"
      data-list-loading
      role="status"
      aria-busy="true"
      class="flex flex-col gap-3"
    >
      <span class="sr-only">{{ lt('datatables.loadingRecords') }}</span>
      <div
        v-for="index in 3"
        :key="index"
        aria-hidden="true"
        :class="skeletonClasses[skeleton]"
        class="rounded-2xl border border-gray-200 bg-gray-100 motion-safe:animate-pulse dark:border-gray-800 dark:bg-gray-900"
      />
    </div>
    <div
      v-else
      role="status"
      aria-busy="true"
      class="py-8 text-center text-gray-600 dark:text-gray-400"
    >
      {{ lt('datatables.loadingRecords') }}
    </div>
  </slot>
  <div v-else-if="failed ?? !!problem" v-bind="errorAttrs" class="flex flex-col gap-3">
    <slot name="error">
      <p role="alert" class="font-medium text-gray-900 dark:text-white">
        {{ errorText ?? t('states.list.error') }}
      </p>
      <ProblemMessage
        :problem="problem"
        :retry="retryPlacement === 'problem'"
        @retry="$emit('retry')"
      />
      <button
        v-if="retryPlacement === 'separate'"
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        @click="$emit('retry')"
      >
        {{ t('common.retry') }}
      </button>
    </slot>
  </div>
  <template v-else>
    <slot name="before-refresh" />
    <p
      v-if="refreshFailed"
      role="alert"
      class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      {{ refreshText ?? t('lists.refreshFailed') }}
    </p>
    <slot name="before-content" />
    <slot v-if="noMatches" name="no-matches">
      <div v-bind="noMatchesAttrs" :class="emptyContainerClass">
        <p :class="emptyTextClass">{{ lt('datatables.zeroRecords') }}</p>
        <button
          v-if="clearLabel"
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          @click="$emit('clear')"
        >
          {{ clearLabel }}
        </button>
      </div>
    </slot>
    <slot v-else-if="empty" name="empty-state">
      <div
        v-if="emptyLayout === 'actions' || emptyLayout === 'centered-actions'"
        v-bind="emptyAttrs"
        :class="emptyContainerClass"
      >
        <p :class="emptyTextClass">
          {{ emptyText ?? lt('datatables.emptyTable') }}
        </p>
        <slot name="empty-actions" />
      </div>
      <p
        v-else-if="emptyLayout === 'plain' || emptyLayout === 'compact'"
        v-bind="emptyAttrs"
        :class="
          emptyLayout === 'compact'
            ? 'py-2 text-sm text-gray-700 dark:text-gray-300'
            : 'py-6 text-gray-700 dark:text-gray-300'
        "
      >
        {{ emptyText ?? lt('datatables.emptyTable') }}
      </p>
      <div v-else v-bind="emptyAttrs" class="py-8 text-center text-gray-600 dark:text-gray-400">
        <slot name="empty">{{ emptyText ?? lt('datatables.emptyTable') }}</slot>
      </div>
    </slot>
    <slot v-else />
  </template>
</template>
