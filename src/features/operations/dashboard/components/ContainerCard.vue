<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

// One container (FR-008, legacy container card): its name as the item's heading, "({image})",
// "(Started on {time})", and legacy's "Running" or "Stopped" (with an icon, never colour alone; no
// animated dots, FR-084). Legacy's caret button expands the details: the resource charts, the
// actions the API allows and the History link (conventions "History and audit").
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Container } from '@/api'
import { lt } from '@/i18n'
import DateTime from '@/shared/components/DateTime.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import { CheckIcon, ChevronDownIcon, CloseIcon } from '@/shared/icons'

import ContainerActions from './ContainerActions.vue'
import ContainerResources from './ContainerResources.vue'

const props = defineProps<{ container: Container; expanded: boolean }>()
defineEmits<{ toggle: [] }>()
const { t } = useI18n()
const panelId = computed(() => `ops-container-${props.container.name}`)
</script>

<template>
  <article
    class="flex h-full flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
    :data-container="container.name"
  >
    <div class="flex items-start gap-3 p-3">
      <div class="min-w-0 flex-1">
        <h3 class="font-semibold wrap-anywhere text-gray-900 dark:text-white">
          {{ container.name }}
        </h3>
        <p class="text-sm wrap-anywhere text-gray-700 dark:text-gray-300">
          ({{ container.image }})
        </p>
        <p class="text-sm text-gray-700 dark:text-gray-300" data-started>
          ({{ lt('debug.started_on') }}
          <DateTime v-if="container.startedAt" :value="container.startedAt" /><template v-else
            >-</template
          >)
        </p>
        <p class="mt-2">
          <Badge v-if="container.running" data-state="running" color="success">
            <CheckIcon class="size-4" />{{ lt('debug.container_running') }}
          </Badge>
          <Badge v-else data-state="stopped" color="error">
            <CloseIcon class="size-4" />{{ lt('debug.container_stopped') }}
          </Badge>
        </p>
      </div>
      <button
        type="button"
        data-expand
        class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-white/5"
        :aria-expanded="expanded ? 'true' : 'false'"
        :aria-controls="panelId"
        :aria-label="
          expanded
            ? t('operations.containers.collapse', { name: container.name })
            : t('operations.containers.expand', { name: container.name })
        "
        @click="$emit('toggle')"
      >
        <ChevronDownIcon class="size-5" :class="expanded ? 'rotate-180' : ''" />
      </button>
    </div>
    <div
      v-if="expanded"
      :id="panelId"
      class="flex flex-col gap-4 border-t border-gray-200 p-3 dark:border-gray-800"
      data-container-details
    >
      <ContainerResources :container="container" />
      <div class="flex flex-wrap items-start justify-between gap-3">
        <ContainerActions :container="container" />
        <HistoryLink target-type="container" :target-id="container.name" />
      </div>
    </div>
  </article>
</template>
