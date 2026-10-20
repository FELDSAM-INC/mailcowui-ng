<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { contrastRatio, ratioLabel } from '@/shared/color/contrast'
const props = defineProps<{ colour: string; surface: string; minimum: number }>()
const { t, locale } = useI18n()
const ratio = computed(() => contrastRatio(props.colour, props.surface))
</script>
<template>
  <p v-if="ratio !== null" data-contrast-report class="text-sm">
    {{
      t('systemSettings.colours.ratio', {
        ratio: ratioLabel(ratio, minimum, locale),
        minimum: ratioLabel(minimum, minimum, locale),
        surface,
      })
    }}
    {{ t(ratio >= minimum ? 'systemSettings.colours.passes' : 'systemSettings.colours.fails') }}
  </p>
</template>
