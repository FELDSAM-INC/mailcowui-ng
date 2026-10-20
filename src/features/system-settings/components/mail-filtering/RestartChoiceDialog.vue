<script setup lang="ts">
import { ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
defineProps<{ empty: boolean }>()
const emit = defineEmits<{ choice: [deferRestart: boolean] }>()
const { t } = useI18n()
const choice = ref('now')
const name = useId()
</script>

<template>
  <div class="space-y-3">
    <p v-if="empty" data-empty-script>{{ t('systemSettings.globalSieve.empty') }}</p>
    <fieldset class="space-y-2">
      <legend class="font-medium">{{ t('systemSettings.globalSieve.apply') }}</legend>
      <label
        v-for="option in ['now', 'later']"
        :key="option"
        class="flex min-h-11 items-center gap-3"
      >
        <input
          v-model="choice"
          type="radio"
          :name="name"
          :value="option"
          class="size-5 shrink-0 accent-accent"
          @change="emit('choice', choice === 'later')"
        />
        <span>{{ t(`systemSettings.globalSieve.${option}`) }}</span>
      </label>
    </fieldset>
  </div>
</template>
