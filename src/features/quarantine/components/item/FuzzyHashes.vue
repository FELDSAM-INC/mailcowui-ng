<script setup lang="ts">
// The item's fuzzy hashes (UI 006 FR-019, legacy form map screen 2): the heading "Fuzzy Hashes"
// that legacy hard-codes, each hash in monospace with a copy control, or "-" when there are none.
import { useI18n } from 'vue-i18n'

import CopyButton from '@/shared/components/CopyButton.vue'
import PlainText from '@/shared/components/PlainText.vue'

defineProps<{ hashes: readonly string[] }>()
const { t } = useI18n()
</script>

<template>
  <section aria-labelledby="qitem-fuzzy" class="flex flex-col gap-2">
    <h2 id="qitem-fuzzy" class="text-lg font-semibold text-gray-900 dark:text-white">
      {{ t('quarantineUi.item.fuzzyHashes') }}
    </h2>
    <ul v-if="hashes.length > 0" data-fuzzy-hashes class="flex flex-col gap-2">
      <li v-for="(hash, index) in hashes" :key="index" class="flex items-center gap-2">
        <span class="min-w-0 flex-1 font-mono text-sm text-gray-900 dark:text-white"
          ><PlainText :value="hash"
        /></span>
        <CopyButton
          :text="hash"
          :label="t('quarantineUi.item.copyFuzzyHash', { number: index + 1 })"
          icon-only
        />
      </li>
    </ul>
    <p v-else class="text-gray-900 dark:text-white">-</p>
  </section>
</template>
