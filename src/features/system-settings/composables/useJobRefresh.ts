import { computed, onScopeDispose, ref, watch } from 'vue'
import type { MassMailJobStatus } from '@/api'
import { inactivityLimit, useInactivity } from '@/shared/composables/useInactivity'

interface JobRefreshOptions {
  status: () => MassMailJobStatus | undefined
  dataUpdatedAt: () => number
  idleTimeout: () => number | null | undefined
  refetch: () => Promise<unknown>
  finished: () => unknown
  announce: () => void
}
export function useJobRefresh(options: JobRefreshOptions) {
  const paused = ref(false),
    inactive = ref(false)
  const visible = ref(document.visibilityState !== 'hidden')
  const activity = useInactivity({ limit: () => inactivityLimit(options.idleTimeout()) })
  const running = computed(() => options.status() === 'running')
  const interval = computed(() =>
    running.value && visible.value && !paused.value && !inactive.value && !activity.idle.value
      ? 5000
      : false,
  )
  watch(
    () => activity.idle.value && running.value && !paused.value,
    (idle) => {
      if (idle) inactive.value = true
    },
  )
  const onVisibility = () => {
    const wasVisible = visible.value
    visible.value = document.visibilityState !== 'hidden'
    if (!wasVisible && interval.value) void options.refetch()
  }
  document.addEventListener('visibilitychange', onVisibility)
  onScopeDispose(() => document.removeEventListener('visibilitychange', onVisibility))
  let lastAnnouncement = Date.now()
  watch(options.dataUpdatedAt, () => {
    if (running.value && visible.value && Date.now() - lastAnnouncement >= 30_000) {
      lastAnnouncement = Date.now()
      options.announce()
    }
  })
  watch(running, (now, before) => {
    if (before && !now && options.status()) {
      options.finished()
      options.announce()
    }
  })
  return {
    running,
    paused,
    inactive,
    interval,
    pause: () => {
      paused.value = true
    },
    resume: () => {
      paused.value = false
      inactive.value = false
      activity.reset()
      if (running.value) void options.refetch()
    },
    refresh: () => {
      activity.reset()
      return options.refetch()
    },
  }
}
