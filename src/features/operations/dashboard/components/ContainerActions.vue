<script setup lang="ts">
// The actions of a container (FR-011–FR-016): exactly the actions the API reports as available
// (Start, Stop, legacy's Restart), in that order, one at a time per container, with the progress,
// the elapsed time (not announced every second) and the outcome. Reused by the Fail2ban screen for
// "Restart netfilter" (`actions` and `restartLabel`).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Container, ContainerAction } from '@/api'
import { text } from '@/i18n'
import { WarningIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { useContainerAction } from '../composables/useContainerAction'
import { PlayIcon, RestartIcon, StopIcon } from '../../icons'

const props = withDefaults(
  defineProps<{
    container: Container
    /** Only these actions (of those available). */
    actions?: readonly ContainerAction[]
    /** The restart button's label instead of `debug.restart_container`. */
    restartLabel?: string
  }>(),
  { actions: () => ['start', 'stop', 'restart'], restartLabel: undefined },
)
const { t } = useI18n()
const runner = useContainerAction(() => props.container)

const ORDER: ContainerAction[] = ['start', 'stop', 'restart']
const ICONS = { start: PlayIcon, stop: StopIcon, restart: RestartIcon }
const shown = computed(() =>
  ORDER.filter(
    (action) => props.container.availableActions.includes(action) && props.actions.includes(action),
  ),
)
const label = (action: ContainerAction) =>
  action === 'restart' && props.restartLabel
    ? props.restartLabel
    : text(`operations.enums.containerAction.${action}`)

const TONES = {
  success: 'text-success-700 dark:text-success-400',
  info: 'text-gray-700 dark:text-gray-300',
  warning: 'text-warning-800 dark:text-warning-200',
  danger: 'text-red-700 dark:text-red-300',
}
</script>

<template>
  <div class="flex flex-col gap-2" data-container-actions>
    <div v-if="shown.length" class="flex flex-wrap gap-2">
      <button
        v-for="action in shown"
        :key="action"
        type="button"
        :data-action="action"
        :class="buttonVariants({ variant: 'outline', size: 'sm' })"
        :aria-disabled="runner.pending.value || undefined"
        @click="!runner.pending.value && runner.run(action)"
      >
        <component :is="ICONS[action]" />
        {{ label(action) }}
      </button>
    </div>
    <p
      v-if="runner.pending.value"
      data-action-progress
      class="text-sm text-gray-700 dark:text-gray-300"
    >
      {{ runner.progress.value }}
      <span class="tabular-nums" aria-hidden="true">
        ({{ t('operations.containers.elapsed', { seconds: runner.elapsed.value }) }})
      </span>
    </p>
    <div v-if="runner.outcome.value" data-action-outcome class="flex flex-col gap-1 text-sm">
      <p class="font-medium" :class="TONES[runner.outcome.value.tone]">
        {{ runner.outcome.value.text }}
      </p>
      <p v-if="runner.outcome.value.detail" class="text-gray-700 dark:text-gray-300">
        {{ runner.outcome.value.detail }}
      </p>
      <p
        v-if="!runner.outcome.value.auditRecorded"
        data-not-recorded
        class="flex items-start gap-2 text-warning-800 dark:text-warning-200"
      >
        <WarningIcon class="mt-0.5 size-4 shrink-0" />
        <span>{{ t('operations.notRecorded') }}</span>
      </p>
    </div>
  </div>
</template>
