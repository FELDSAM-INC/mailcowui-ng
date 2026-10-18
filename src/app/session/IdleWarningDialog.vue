<script setup lang="ts">
// The idle warning (FR-032, FR-082, research R12, WCAG 2.2.1): a Reka AlertDialog, so it is
// announced and traps focus. It counts down to the idle deadline, announces 120, 60 and 30 seconds
// left, and offers "Stay signed in" (one GET /session, which renews the server's idle timer) and
// "Sign out". Escape keeps the session, like "Stay signed in". Mounted once, in App.vue.
import {
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { queryKeys } from '@/api'
import { useFormat } from '@/i18n/format'
import { announce } from '@/shared/composables/useAnnouncer'
import { useCountdown } from '@/shared/composables/useCountdown'
import { buttonVariants } from '@/shared/ui/button'

import { sessionContext } from './context'
import { idleDeadline } from './idle-timer'
import { fetchSession, isSignedIn } from './queries'
import { endSession } from './session-end'
import { useSignOut } from './sign-out'
import { useSessionStore } from './store'

const { t } = useI18n()
const fmt = useFormat()
const store = useSessionStore()
const staying = ref(false)
const { signOut, pending: signingOut } = useSignOut()

const countdown = useCountdown({
  deadline: () =>
    store.idleWarningOpen ? idleDeadline(store.lastActivityAt, store.idleTimeout) : null,
  milestones: [120, 60, 30],
  onMilestone: (seconds) =>
    announce(t('session.idle.remaining', { time: fmt.duration(seconds) }), { assertive: true }),
})
const remaining = computed(() => fmt.clock(countdown.remaining.value))

async function staySignedIn() {
  if (staying.value) return
  staying.value = true
  try {
    const ctx = sessionContext()
    const session = await fetchSession()
    if (isSignedIn(session)) {
      ctx.queryClient.setQueryData(queryKeys.session(), session)
      store.idleWarningOpen = false
    } else {
      await endSession(ctx)
    }
  } catch {
    // The response (if any) counted as activity; a lost connection leaves the warning open.
  } finally {
    staying.value = false
  }
}

function onOpenChange(open: boolean) {
  if (!open) void staySignedIn()
}
</script>

<template>
  <AlertDialogRoot :open="store.idleWarningOpen" @update:open="onOpenChange">
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-100 bg-black/50 dark:bg-black/70" />
      <AlertDialogContent
        class="fixed start-1/2 top-1/2 z-101 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-gray-200 bg-white p-6 text-gray-700 shadow-theme-lg outline-none sm:max-w-md dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
      >
        <AlertDialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('session.idle.title') }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('session.idle.body', { time: remaining }) }}
        </AlertDialogDescription>
        <!-- "Stay signed in" comes first, so it receives the initial focus. -->
        <div class="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
          <button
            type="button"
            :class="buttonVariants({ variant: 'default' })"
            :disabled="staying"
            :aria-busy="staying ? 'true' : undefined"
            @click="staySignedIn"
          >
            {{ t('session.idle.stay') }}
          </button>
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            :disabled="signingOut"
            @click="signOut"
          >
            {{ t('common.signOut') }}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
