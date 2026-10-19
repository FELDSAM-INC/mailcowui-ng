<script setup lang="ts">
// Why a mailbox cannot be removed now (the preview's blockers): each unreachable store by name.
import { useI18n } from 'vue-i18n'

import { text } from '@/i18n'

import type { DeletionImpact } from '../../deletion'
import { blockerKey } from '../../labels'

defineProps<{ impact: DeletionImpact; readable: string }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-300">
    <p>{{ t('mailboxes.delete.blocked', { address: readable }) }}</p>
    <ul class="list-disc ps-5">
      <li v-for="blocker in impact.blockers" :key="blocker.dependency" data-blocker>
        {{ text(blockerKey(blocker.dependency)) }}
      </li>
    </ul>
  </div>
</template>
