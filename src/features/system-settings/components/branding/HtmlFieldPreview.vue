<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SanitizedHtml from '@/shared/components/SanitizedHtml.vue'
import { sanitizeHtmlWithReport } from '@/shared/security/sanitize-report'
const props = defineProps<{ html: string }>()
const { t } = useI18n()
const report = computed(() => sanitizeHtmlWithReport(props.html))
</script>
<template>
  <div class="min-w-0 space-y-3 wrap-anywhere" data-html-preview>
    <div
      v-if="report.html"
      tabindex="0"
      role="region"
      :aria-label="t('systemSettings.uiTexts.preview')"
      class="max-h-80 min-w-0 overflow-auto rounded focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <SanitizedHtml :html="report.html" />
    </div>
    <p v-else>{{ t('systemSettings.uiTexts.emptyHidden') }}</p>
    <p
      v-if="report.removed.length"
      data-html-removed
      class="text-sm text-gray-700 dark:text-gray-300"
    >
      {{
        t('systemSettings.uiTexts.removed', {
          kinds: report.removed
            .map((kind) => t(`systemSettings.uiTexts.removedKinds.${kind}`))
            .join(', '),
        })
      }}
    </p>
    <p class="text-sm text-gray-700 dark:text-gray-300">
      {{ t('systemSettings.uiTexts.classicHtml') }}
    </p>
  </div>
</template>
