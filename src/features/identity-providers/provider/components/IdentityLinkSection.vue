<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { problemOf } from '@/api'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import FormField from '@/shared/components/FormField.vue'
import { confirm } from '@/shared/composables/useConfirm'
import { buttonVariants } from '@/shared/ui/button'
import { getIdentityLink, deleteIdentityLink, type IdentityLink } from '../synchronisation-api'
import { INPUT } from './styles'
const { t } = useI18n()
const mailbox = ref('')
const link = shallowRef<IdentityLink | null>()
const busy = ref(false)
const problem = shallowRef<ReturnType<typeof problemOf>>(null)
async function lookup() {
  if (busy.value || !mailbox.value.trim()) return
  busy.value = true
  problem.value = null
  link.value = undefined
  try {
    link.value = await getIdentityLink(mailbox.value.trim().toLowerCase())
  } catch (error) {
    problem.value = problemOf(error)
  } finally {
    busy.value = false
  }
}
async function unlink() {
  const selected = link.value
  if (
    !selected ||
    busy.value ||
    !(await confirm({
      title: t('identitySync.unlink'),
      description: t('identitySync.unlinkBody', { mailbox: selected.mailbox }),
      confirmLabel: t('identitySync.unlink'),
      destructive: true,
    }))
  )
    return
  busy.value = true
  problem.value = null
  try {
    await deleteIdentityLink(selected.mailbox, selected.etag)
    link.value = null
  } catch (error) {
    problem.value = problemOf(error)
    link.value = undefined
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <section class="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5">
    <h2 class="text-lg font-semibold">{{ t('identitySync.linksTitle') }}</h2>
    <p class="text-sm text-muted">{{ t('identitySync.linksHelp') }}</p>
    <form class="flex flex-wrap items-end gap-2" @submit.prevent="lookup">
      <FormField
        id="identity-link-mailbox"
        :label="t('identitySync.mailbox')"
        class="min-w-0 flex-1"
        ><template #default="control"
          ><input
            v-bind="control"
            v-model="mailbox"
            type="email"
            required
            :class="INPUT"
            autocomplete="off" /></template></FormField
      ><button :class="buttonVariants({ variant: 'outline' })" :disabled="busy">
        {{ t('identitySync.lookup') }}
      </button>
    </form>
    <ProblemMessage :problem="problem" />
    <p v-if="link === null" role="status">{{ t('identitySync.noLink') }}</p>
    <div v-if="link" class="flex flex-wrap items-center gap-3">
      <p class="min-w-0 flex-1 break-words text-sm">
        {{ link.mailbox }} · {{ link.provider }} · {{ link.externalId || '—' }}
      </p>
      <button
        type="button"
        :class="buttonVariants({ variant: 'destructive' })"
        :disabled="busy"
        @click="unlink"
      >
        {{ t('identitySync.unlink') }}
      </button>
    </div>
  </section>
</template>
