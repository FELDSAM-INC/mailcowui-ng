<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { contrastRatio, foreground, hoverColor } from '@/shared/color/contrast'
import { buttonVariants } from '@/shared/ui/button'
import { Switch } from '@/shared/ui/switch'
import ContrastReport from './ContrastReport.vue'
const props = defineProps<{
  theme: 'light' | 'dark'
  colour: string | null
  surface: string
  minimum: number
  inherited?: boolean
}>()
const { t } = useI18n()
const switchId = useId()
const valid = computed(() =>
  props.colour && (contrastRatio(props.colour, props.surface) ?? 0) >= props.minimum
    ? props.colour
    : null,
)
const palette = computed(() =>
  props.theme === 'dark'
    ? {
        primary: '#53c58a',
        foreground: '#14181d',
        info: '#88bfff',
        ink: '#eef2f5',
        surface: '#222932',
      }
    : {
        primary: '#18794e',
        foreground: '#ffffff',
        info: '#2563b4',
        ink: '#19242d',
        surface: '#ffffff',
      },
)
const variables = computed(() => ({
  '--accent': valid.value ?? palette.value.primary,
  '--accent-foreground': valid.value ? foreground(valid.value)! : palette.value.foreground,
  '--accent-text': valid.value ?? palette.value.info,
  '--accent-hover': valid.value
    ? hoverColor(valid.value, foreground(valid.value)!)!
    : `color-mix(in srgb, ${palette.value.primary} 88%, ${props.theme === 'dark' ? '#ffffff' : '#000000'})`,
  backgroundColor: palette.value.surface,
  color: palette.value.ink,
  colorScheme: props.theme,
}))
</script>
<template>
  <section
    :data-brand-preview="theme"
    :style="variables"
    class="min-w-0 space-y-3 rounded-xl border border-gray-400 p-4"
  >
    <h3 data-preview-header class="font-semibold">
      {{ t(theme === 'light' ? 'themes.light' : 'themes.dark') }} —
      {{ t('systemSettings.colours.preview') }}
    </h3>
    <ContrastReport v-if="colour" :colour="colour" :surface="surface" :minimum="minimum" />
    <p v-if="inherited" data-dark-rule class="text-sm">
      {{ t(valid ? 'systemSettings.colours.darkUsesLight' : 'systemSettings.colours.darkDefault') }}
    </p>
    <p v-else-if="colour && !valid" class="text-sm">
      {{ t('systemSettings.colours.previewDefault') }}
    </p>
    <div class="flex flex-col items-start gap-2">
      <button
        type="button"
        data-preview-button
        :class="buttonVariants({ class: 'h-auto min-h-11 whitespace-normal text-start' })"
      >
        {{ t('systemSettings.colours.sampleButton') }}
      </button>
      <a
        href="#colour-preview"
        data-preview-link
        class="inline-flex min-h-11 items-center text-accent-text underline underline-offset-2"
        >{{ t('systemSettings.colours.sampleLink') }}</a
      >
      <span
        data-preview-navigation
        class="inline-flex min-h-11 items-center rounded-lg bg-accent px-3 text-accent-foreground"
        >{{ t('systemSettings.colours.sampleNavigation') }}</span
      >
      <label :for="switchId" class="flex min-h-11 items-center gap-3"
        ><Switch :id="switchId" :model-value="true" data-preview-switch />{{
          t('systemSettings.colours.sampleSwitch')
        }}</label
      >
    </div>
  </section>
</template>
