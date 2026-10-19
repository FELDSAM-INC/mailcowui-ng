<script setup lang="ts">
// "Publish DNS record again" (US7, research R16, FR-045; administrators, while the server
// publishes records): sends the key's version tag, shows the outcome and keeps it for the entry
// page; publication turned off meanwhile shows the reason and refreshes the capabilities, which
// removes the action; a key changed elsewhere (412) is read again and offered once more.
import { useQueryClient } from '@tanstack/vue-query'
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { isApiProblem, type ApiProblem, type DkimDnsPublicationOutcome, type DkimKey } from '@/api'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { SyncIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'

import { refreshCapabilitiesOn } from '../api/capabilities'
import { fetchDkimKey, publishRecord } from '../api/dkim'
import PublicationOutcome from './PublicationOutcome.vue'

const props = withDefaults(defineProps<{ entry: DkimKey; showOutcome?: boolean }>(), {
  showOutcome: true,
})
const emit = defineEmits<{ published: [outcome: DkimDnsPublicationOutcome] }>()
const { t } = useI18n()
const client = useQueryClient()
const pending = ref(false)
const problem = shallowRef<ApiProblem | null>(null)
const outcome = shallowRef<DkimDnsPublicationOutcome | null>(null)
const outdated = ref(false)
let version = props.entry.etag

async function publish() {
  if (pending.value || !version) return
  pending.value = true
  problem.value = null
  outdated.value = false
  try {
    const result = await publishRecord(client, props.entry.name, version)
    version = result.etag
    outcome.value = result.dnsPublication
    announce(t(`dns.publication.status.${result.dnsPublication.status}`))
    emit('published', result.dnsPublication)
  } catch (error) {
    if (isApiProblem(error) && error.status === 412) {
      version = (await fetchDkimKey(props.entry.name).catch(() => props.entry)).etag
      outdated.value = true
    } else {
      problem.value = isApiProblem(error) ? error : null
      refreshCapabilitiesOn(error, client)
    }
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <span class="inline-flex flex-col items-start gap-2">
    <button
      type="button"
      data-publish-again
      :class="buttonVariants({ variant: 'outline' })"
      :disabled="pending"
      @click="publish"
    >
      <SyncIcon :class="pending ? 'motion-safe:animate-spin' : ''" />
      {{ t('dns.publication.publishAgain.action') }}
    </button>
    <p v-if="outdated" role="alert" class="text-sm text-amber-800 dark:text-amber-200">
      {{ t('dns.publication.publishAgain.outdated') }}
    </p>
    <ProblemMessage v-if="problem" :problem="problem" />
    <PublicationOutcome v-if="showOutcome && outcome" :outcome="outcome" :enabled="true" />
  </span>
</template>
