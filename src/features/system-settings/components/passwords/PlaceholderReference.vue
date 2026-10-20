<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { lt } from '@/i18n'
import CopyButton from '@/shared/components/CopyButton.vue'
import SanitizedHtml from '@/shared/components/SanitizedHtml.vue'
import { resetPlaceholders } from '../../lib/email-samples'

const { t } = useI18n()
const targets = reactive<Record<string, HTMLElement | null>>({})
function setTarget(name: string, element: unknown) {
  targets[name] = element instanceof HTMLElement ? element : null
}
// Legacy supplies the six meanings in the same order. Preserve its translated text, while
// attaching a keyboard-accessible copy action to each actual placeholder.
const entries = computed(() => {
  const descriptions = lt('admin.reset_password_vars').split(/<br\s*\/?>/i)
  return resetPlaceholders.map((name, i) => ({
    name,
    code: `{{${name}}}`,
    description: (descriptions[i] ?? '').replace(/^.*?<\/code>/i, '').trim(),
  }))
})
</script>

<template>
  <ul data-placeholder-reference class="space-y-3 text-sm text-gray-700 dark:text-gray-300">
    <li v-for="item in entries" :key="item.name" class="flex min-w-0 items-start gap-3">
      <div class="min-w-0 flex-1 space-y-1">
        <code :ref="(element) => setTarget(item.name, element)" class="break-all">{{
          item.code
        }}</code>
        <SanitizedHtml :html="item.description" profile="legacy" />
      </div>
      <CopyButton
        :text="item.code"
        :label="t('systemSettings.passwordReset.copyPlaceholder', { placeholder: item.code })"
        :select-target="targets[item.name]"
      />
    </li>
  </ul>
</template>
