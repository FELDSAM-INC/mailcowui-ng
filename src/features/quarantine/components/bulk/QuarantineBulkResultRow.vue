<script setup lang="ts">
import type { QuarantineItem } from '@/api'
import { lt } from '@/i18n'
import PlainText from '@/shared/components/PlainText.vue'

import type { OutcomeLine } from '../../action-outcome'

defineProps<{ item?: QuarantineItem; lines: readonly OutcomeLine[] }>()
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1 text-sm wrap-anywhere">
    <template v-if="item">
      <p><PlainText :value="item.subject || '-'" /></p>
      <p>{{ lt('quarantine.rcpt') }}: <PlainText :value="item.recipient" /></p>
    </template>
    <!-- The shared summary announces the counts once; individual reports remain readable. -->
    <p
      v-for="(line, index) in lines"
      :key="index"
      :data-alert="line.kind"
      :class="
        line.kind === 'success'
          ? 'text-green-800 dark:text-green-300'
          : line.kind === 'warning'
            ? 'text-amber-900 dark:text-amber-100'
            : 'text-red-800 dark:text-red-300'
      "
    >
      <PlainText :value="line.text" />
    </p>
  </div>
</template>
