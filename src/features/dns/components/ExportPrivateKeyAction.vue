<script setup lang="ts">
// Exporting a DKIM private key (US6, research R12, FR-077; legacy's "Private key" link and
// `showDKIMprivKey` modal): asked first (the key lets its holder sign mail for the name, and the
// export is recorded), read with a direct call through `useSecretRequest` (never a cache), shown
// once in `OneTimeSecretDialog` with copy and download, and forgotten when the dialog closes.
// Export turned off meanwhile shows the reason and refreshes the capabilities, which removes the
// action.
import { useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DkimKey } from '@/api'
import { lt } from '@/i18n'
import OneTimeSecretDialog from '@/shared/components/OneTimeSecretDialog.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { confirm } from '@/shared/composables/useConfirm'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { KeyIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { refreshCapabilitiesOn } from '../api/capabilities'
import { exportKey } from '../api/dkim-secrets'
import { privateKeyFileName } from '../names'

const props = defineProps<{ entry: DkimKey }>()
const { t } = useI18n()
const client = useQueryClient()
const request = useSecretRequest(exportKey)
const secret = computed(() => request.result.value?.privateKey ?? null)
const download = computed(() =>
  request.result.value
    ? {
        fileName: privateKeyFileName(request.result.value.selector, request.result.value.name),
        mediaType: 'application/x-pem-file',
      }
    : undefined,
)

async function start() {
  if (request.pending.value) return
  request.clear()
  const go = await confirm({
    title: lt('admin.dkim_private_key'),
    description: t('dns.dkim.export.confirm', { name: props.entry.displayName }),
    confirmLabel: t('dns.dkim.export.action'),
  })
  if (!go) return
  await request.run(props.entry.name)
  if (request.problem.value) refreshCapabilitiesOn(request.problem.value, client)
}
</script>

<template>
  <span class="contents">
    <button
      type="button"
      data-export
      :class="buttonVariants({ variant: 'outline' })"
      :disabled="request.pending.value"
      @click="start"
    >
      <KeyIcon />
      {{ lt('admin.dkim_private_key') }}
    </button>
    <div v-if="request.problem.value" class="basis-full">
      <ProblemMessage :problem="request.problem.value" />
    </div>
    <OneTimeSecretDialog
      :secret="secret"
      :title="lt('admin.dkim_private_key')"
      multiline
      :download="download"
      @close="request.clear()"
    />
  </span>
</template>
