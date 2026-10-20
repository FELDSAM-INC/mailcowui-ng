<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import type { SieveFilter } from '@/api'
import { lt } from '@/i18n'
import { buttonVariants } from '@/shared/ui/button'
import ScriptBlock from './ScriptBlock.vue'
defineProps<{
  item: SieveFilter
  location: RouteLocationRaw
  selecting: boolean
  selected: boolean
  canChange: boolean
  busy: boolean
}>()
defineEmits<{ toggle: []; remove: [] }>()
const { t } = useI18n()
</script>
<template>
  <article class="surface flex min-w-0 flex-col gap-3 text-sm text-gray-800 dark:text-gray-200">
    <label v-if="selecting" class="flex min-h-11 items-center gap-3"
      ><input
        type="checkbox"
        class="size-5"
        :checked="selected"
        :disabled="busy"
        @change="$emit('toggle')"
      />{{ item.description }}</label
    >
    <dl class="grid gap-2">
      <div>
        <dt class="font-medium">{{ t('lists.id') }}</dt>
        <dd>{{ item.id }}</dd>
      </div>
      <div>
        <dt class="font-medium">{{ lt('mailbox.owner') }}</dt>
        <dd class="wrap-anywhere">{{ item.mailbox }}</dd>
      </div>
      <div>
        <dt class="font-medium">{{ lt('mailbox.description') }}</dt>
        <dd class="wrap-anywhere">{{ item.description }}</dd>
      </div>
      <div>
        <dt class="font-medium">{{ t('filters.columns.type') }}</dt>
        <dd>{{ t(`filters.kind.${item.kind}`) }}</dd>
      </div>
      <div>
        <dt class="font-medium">{{ lt('mailbox.active') }}</dt>
        <dd>{{ lt(item.active ? 'mailbox.active' : 'mailbox.inactive') }}</dd>
      </div>
    </dl>
    <details class="min-w-0">
      <summary class="min-h-11 cursor-pointer content-center font-medium">
        {{ t('filters.columns.script') }}
      </summary>
      <ScriptBlock :script="item.script" />
    </details>
    <div class="flex flex-wrap gap-2">
      <RouterLink
        :to="location"
        :aria-label="`${lt('mailbox.edit')}: ${item.description}`"
        :class="buttonVariants({ variant: 'outline' })"
        >{{ lt('mailbox.edit') }}</RouterLink
      >
      <button
        v-if="canChange"
        type="button"
        :disabled="busy"
        :aria-label="`${lt('mailbox.remove')}: ${item.description}`"
        :class="buttonVariants({ variant: 'outline' })"
        @click="$emit('remove')"
      >
        {{ lt('mailbox.remove') }}
      </button>
    </div>
  </article>
</template>
