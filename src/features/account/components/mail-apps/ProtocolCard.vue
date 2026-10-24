<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CopyButton from '@/shared/components/CopyButton.vue'
defineProps<{ title: string; fields: { label: string; value: string }[]; note?: string }>()
const { t } = useI18n()
const targets = ref<(HTMLElement | null)[]>([])
</script>
<template>
  <section class="flex min-w-0 flex-col gap-4 rounded-xl border border-line p-4">
    <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ title }}</h3>
    <p v-if="note" class="text-sm text-gray-700 dark:text-gray-300">{{ note }}</p>
    <dl class="flex flex-col gap-3">
      <div v-for="(field, index) in fields" :key="`${field.label}:${index}`" class="min-w-0">
        <dt class="text-sm text-gray-600 dark:text-gray-400">{{ field.label }}</dt>
        <dd class="flex min-w-0 items-center justify-between gap-3">
          <span
            :ref="
              (element) => {
                targets[index] = element as HTMLElement | null
              }
            "
            class="min-w-0 wrap-anywhere text-gray-900 dark:text-white"
            >{{ field.value }}</span
          >
          <CopyButton
            :text="field.value"
            :label="`${t('secrets.copy')}: ${title}, ${field.label}`"
            :select-target="targets[index]"
            icon-only
          />
        </dd>
      </div>
    </dl>
  </section>
</template>
