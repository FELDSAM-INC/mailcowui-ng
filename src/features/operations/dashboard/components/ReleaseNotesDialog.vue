<script setup lang="ts">
// Release notes (FR-027, FR-028, legacy `#showVersionModal`): full screen below md and a dialog from
// md up, titled as legacy ("New Release {tag}", "Version {tag}"), the notes rendered safely (raw
// HTML as text, images as links, links in a new window without access to the app; nothing loaded
// from elsewhere) and, for a new release, legacy's "Github Link:" with the release page. The
// Markdown renderer is loaded only when the dialog opens.
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lt } from '@/i18n'
import SanitizedHtml from '@/shared/components/SanitizedHtml.vue'
import { useMediaQuery } from '@/shared/composables/useMediaQuery'
import { CloseIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

const props = defineProps<{ title: string; notes: string; tag: string; url?: string | null }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const wide = useMediaQuery('(min-width: 768px)')

const html = ref<string | null>(null)
const failed = ref(false)

async function render() {
  failed.value = false
  html.value = null
  try {
    const { renderReleaseNotes } = await import('../release-notes/render-release-notes')
    html.value = await renderReleaseNotes(props.notes, {
      image: (description) => t('operations.updates.image', { description }),
      imageUntitled: t('operations.updates.imageUntitled'),
    })
  } catch {
    failed.value = true
  }
}
onMounted(render)

const CONTENT_WIDE =
  'fixed start-1/2 top-1/2 z-101 flex max-h-[90vh] w-[min(48rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 text-gray-700 shadow-theme-lg outline-none rtl:translate-x-1/2 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'
const CONTENT_FULL =
  'fixed inset-0 z-101 flex h-dvh w-full flex-col gap-4 bg-white p-4 text-gray-700 outline-none dark:bg-gray-900 dark:text-gray-300'
const NOTES =
  'min-h-0 flex-1 overflow-y-auto wrap-anywhere [&_a]:text-accent-text [&_a]:bg-white dark:[&_a]:bg-gray-900 [&_a]:underline [&_blockquote]:border-s-4 [&_blockquote]:border-gray-300 [&_blockquote]:ps-3 [&_code]:font-mono [&_code]:text-sm [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:ms-5 [&_ol]:list-decimal [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-gray-100 [&_pre]:p-3 dark:[&_pre]:bg-gray-800 [&_table]:my-2 [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_th]:border [&_th]:border-gray-200 [&_th]:px-2 dark:[&_td]:border-gray-700 dark:[&_th]:border-gray-700 [&_ul]:list-disc'
</script>

<template>
  <DialogRoot :open="true" @update:open="(open) => !open && emit('close')">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-100 bg-black/50 dark:bg-black/70" />
      <DialogContent :class="wide ? CONTENT_WIDE : CONTENT_FULL" :aria-describedby="undefined">
        <div class="flex items-start gap-3">
          <DialogTitle
            class="min-w-0 flex-1 text-lg font-semibold wrap-anywhere text-gray-900 dark:text-white"
          >
            {{ title }}
          </DialogTitle>
          <button
            type="button"
            :class="buttonVariants({ variant: 'ghost', size: 'icon' })"
            :aria-label="t('common.close')"
            @click="emit('close')"
          >
            <CloseIcon />
          </button>
        </div>
        <div v-if="failed" role="alert" class="flex flex-col items-start gap-3">
          <p>{{ t('operations.updates.notesFailed') }}</p>
          <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="render">
            {{ t('common.retry') }}
          </button>
        </div>
        <p v-else-if="html === null" role="status">{{ lt('datatables.loadingRecords') }}</p>
        <SanitizedHtml
          v-else
          :html="html"
          profile="releaseNotes"
          :class="NOTES"
          data-release-notes
        />
        <p v-if="url" class="wrap-anywhere">
          <b>{{ t('operations.updates.githubLink') }}</b>
          {{ ' ' }}
          <a
            :href="url"
            target="_blank"
            rel="noopener noreferrer nofollow"
            class="text-accent-text bg-white dark:bg-gray-900 underline"
            >{{ tag }}<span class="sr-only"> {{ t('common.opensInNewTab') }}</span></a
          >
        </p>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
