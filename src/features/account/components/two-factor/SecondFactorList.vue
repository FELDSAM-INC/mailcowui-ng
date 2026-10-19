<script setup lang="ts">
// The own second factors (UI 005 US2, FR-043, FR-051 to FR-054, research R9; decisions D10, D11):
// each entry's name, its method (legacy's names), "Inactive", "No longer supported" and "used for
// this sign-in" as text, and "Remove". The only active, usable entry turns two-factor
// authentication off instead (current password, every entry removed, passkeys stay); other entries
// are removed after legacy's "Are you sure?". With a policy that requires a second factor, nothing
// can be removed and legacy's note says why.
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { isApiProblem, problemOf, type OwnSecondFactor } from '@/api'
import { lt, text } from '@/i18n'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { confirm } from '@/shared/composables/useConfirm'
import { buttonVariants } from '@/shared/ui/button'

import { afterSecondFactorChange, deleteOwnSecondFactor } from '../../api/second-factors'
import { secondFactorTypeKey } from '../../labels'
import TurnOffTwoFactorDialog from './TurnOffTwoFactorDialog.vue'

const props = defineProps<{
  entries: readonly OwnSecondFactor[]
  /** The policy requires a second factor: nothing can be removed (FR-054). */
  required: boolean
  username: string
}>()
const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const queryClient = useQueryClient()
const turningOff = ref(false)
const problem = ref<ReturnType<typeof problemOf>>(null)

const counting = computed(() => props.entries.filter((entry) => entry.active && entry.usable))
const isOnlyActive = (entry: OwnSecondFactor) =>
  entry.active && entry.usable && counting.value.length === 1

function done() {
  announce(lt('success.object_modified', props.username))
  emit('changed')
}

async function remove(entry: OwnSecondFactor) {
  problem.value = null
  if (isOnlyActive(entry)) {
    turningOff.value = true
    return
  }
  const confirmed = await confirm({
    title: lt('admin.ays'),
    description: entry.name,
    confirmLabel: lt('admin.remove'),
    destructive: true,
  })
  if (!confirmed) return
  try {
    await deleteOwnSecondFactor(queryClient, entry.id)
    done()
  } catch (error) {
    const failure = problemOf(error)
    if (failure?.is('last-second-factor')) {
      // Changed elsewhere: it is now the only active entry (FR-052).
      await queryClient.refetchQueries({ queryKey: ['me', 'second-factors'] })
      turningOff.value = true
      return
    }
    problem.value = isApiProblem(failure) ? failure : null
  }
}

function turnedOff() {
  turningOff.value = false
  afterSecondFactorChange(queryClient)
  done()
}

defineExpose({ turnOff: () => (turningOff.value = true) })
</script>

<template>
  <div class="flex flex-col gap-3">
    <LegacyText
      v-if="required"
      k="danger.tfa_removal_blocked"
      as="p"
      data-policy-note
      class="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 dark:border-gray-800 dark:bg-white/5 dark:text-gray-200"
    />
    <ProblemMessage :problem="problem" />
    <p v-if="entries.length === 0" data-empty class="text-gray-700 dark:text-gray-300">
      {{ lt('user.no_record') }}
    </p>
    <ul v-else class="flex flex-col gap-2" data-second-factors>
      <li
        v-for="entry in entries"
        :key="entry.id"
        :data-entry="entry.id"
        class="surface flex flex-col gap-2 p-4! sm:flex-row sm:items-center sm:justify-between sm:p-4!"
      >
        <div class="min-w-0">
          <p class="font-medium wrap-anywhere text-gray-900 dark:text-white">{{ entry.name }}</p>
          <p class="text-sm text-gray-700 dark:text-gray-300">
            {{ text(secondFactorTypeKey(entry.type)) }}
          </p>
          <ul class="mt-1 flex flex-wrap gap-2 text-xs">
            <li
              v-if="!entry.usable"
              class="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
            >
              {{ t('account.twoFactor.unsupported') }}
            </li>
            <li
              v-else-if="!entry.active"
              class="rounded-full bg-gray-100 px-2 py-0.5 text-gray-800 dark:bg-white/10 dark:text-gray-200"
            >
              {{ lt('mailbox.inactive') }}
            </li>
            <li
              v-if="entry.usedForCurrentSignIn"
              class="rounded-full bg-green-100 px-2 py-0.5 text-green-900 dark:bg-green-500/15 dark:text-green-200"
            >
              {{ t('account.twoFactor.usedForSignIn') }}
            </li>
          </ul>
        </div>
        <button
          v-if="!required"
          type="button"
          :class="
            buttonVariants({
              variant: 'outline',
              size: 'sm',
              class: 'min-h-11 self-start sm:self-center',
            })
          "
          :aria-label="`${lt('admin.remove')}: ${entry.name}`"
          @click="remove(entry)"
        >
          {{ lt('admin.remove') }}
        </button>
      </li>
    </ul>
    <TurnOffTwoFactorDialog :open="turningOff" @close="turningOff = false" @done="turnedOff" />
  </div>
</template>
