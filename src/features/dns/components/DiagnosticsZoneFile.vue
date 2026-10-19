<script setup lang="ts">
// The zone file of a diagnostics result (FR-067, SC-009): legacy's "Download", saving
// `<name>.txt` byte for byte, a copy button, and the text in a view that starts collapsed.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import CopyButton from '@/shared/components/CopyButton.vue'
import { ChevronDownIcon } from '@/shared/icons'
import { downloadText } from '@/shared/platform/download'
import { buttonVariants } from '@/shared/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible'

import { zoneFileName } from '../names'

const props = defineProps<{ name: string; zoneFile: string }>()
const { t } = useI18n()
const open = ref(false)
const view = ref<HTMLElement | null>(null)

function save() {
  downloadText(props.zoneFile, zoneFileName(props.name), 'text/plain')
}
</script>

<template>
  <section
    data-zone-panel
    aria-labelledby="zone-file-title"
    class="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
  >
    <h2 id="zone-file-title" class="text-lg font-semibold text-gray-900 dark:text-white">
      {{ t('dns.diagnostics.zone.title') }}
    </h2>
    <Collapsible v-model:open="open" class="flex flex-col gap-3">
      <div class="flex flex-wrap items-start gap-2">
        <button
          type="button"
          data-zone-download
          :class="buttonVariants({ variant: 'outline' })"
          @click="save"
        >
          {{ t('dns.diagnostics.zone.download') }}
        </button>
        <CopyButton
          :text="zoneFile"
          :label="t('dns.diagnostics.zone.copy')"
          :select-target="view"
        />
        <CollapsibleTrigger data-zone-toggle :class="buttonVariants({ variant: 'ghost' })">
          <ChevronDownIcon class="size-4" :class="open ? 'rotate-180' : ''" />
          {{ open ? t('dns.diagnostics.zone.hide') : t('dns.diagnostics.zone.show') }}
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <pre
          ref="view"
          data-zone-file
          class="max-h-96 overflow-auto rounded-lg bg-gray-50 p-3 font-mono text-sm whitespace-pre-wrap wrap-anywhere text-gray-900 dark:bg-gray-950 dark:text-white"
          >{{ zoneFile }}</pre>
      </CollapsibleContent>
    </Collapsible>
  </section>
</template>
