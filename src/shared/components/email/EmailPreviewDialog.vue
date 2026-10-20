<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { populateEmailPreview } from '@/shared/lib/email-html'

const props = defineProps<{ html: string }>()
const wide = useMediaQuery('(min-width: 768px)')
const open = defineModel<boolean>('open', { required: true })
const { t } = useI18n()
const frame = ref<HTMLIFrameElement | null>(null)
function render(element: HTMLIFrameElement | null) {
  const target = element?.contentDocument
  if (target)
    populateEmailPreview(target, props.html, (alt) => t('emailTemplate.imageOmitted', { alt }))
}
// Chromium may finish the initial blank document before Vue attaches the load listener. Render
// an already loaded document after mount too; the load callback handles replacement documents.
watch(
  frame,
  (element) => {
    if (element?.contentDocument?.readyState === 'complete') render(element)
  },
  { flush: 'post' },
)
function loaded(event: Event) {
  render(event.target as HTMLIFrameElement)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :full-screen="!wide"
      :class="wide ? 'flex h-[min(90dvh,56rem)] flex-col sm:max-w-4xl' : 'min-h-0'"
    >
      <DialogTitle class="pe-10 text-lg font-semibold">{{
        t('emailTemplate.preview')
      }}</DialogTitle>
      <DialogDescription>{{ t('emailTemplate.previewNote') }}</DialogDescription>
      <!-- No src/srcdoc, scripts, forms, popups or navigation. The blank document inherits CSP. -->
      <iframe
        ref="frame"
        sandbox="allow-same-origin"
        :title="t('emailTemplate.preview')"
        class="min-h-0 w-full flex-1 rounded-lg border border-gray-300 bg-white"
        @load="loaded"
      />
    </DialogContent>
  </Dialog>
</template>
