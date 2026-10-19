<script setup lang="ts">
// "Publish DNS record again" (US7, research R16, FR-045; administrators, while the server
// publishes records): sends the key's version tag, shows the outcome and keeps it for the entry
// page; publication turned off meanwhile shows the reason and refreshes the capabilities, which
// removes the action; a key changed elsewhere (412) is read again and offered once more. A page
// that removes the action passes `showRefusal: false` and shows the emitted refusal itself, so the
// reason stays after the action is gone (spec edge case "turned off between loading and acting").
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

const props = withDefaults(
  defineProps<{ entry: DkimKey; showOutcome?: boolean; showRefusal?: boolean }>(),
  { showOutcome: true, showRefusal: true },
)
const emit = defineEmits<{
  published: [outcome: DkimDnsPublicationOutcome]
  refused: [problem: ApiProblem]
}>()
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
      const refused = refreshCapabilitiesOn(error, client) && isApiProblem(error)
      if (refused) emit('refused', error)
      problem.value = isApiProblem(error) && !(refused && !props.showRefusal) ? error : null
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
