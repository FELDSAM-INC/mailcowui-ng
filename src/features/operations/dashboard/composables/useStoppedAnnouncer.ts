// A container that stops running while the dashboard is shown is announced once, politely and
// without moving the focus (FR-024); automatic updates are otherwise silent.
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Container } from '@/api'
import { announce } from '@/shared/composables/useAnnouncer'

export function useStoppedAnnouncer(containers: () => readonly Container[] | undefined) {
  const { t } = useI18n()
  let previous: Map<string, boolean> | null = null
  watch(
    containers,
    (list) => {
      if (!list) return
      const current = new Map(list.map((container) => [container.name, container.running]))
      if (previous) {
        for (const [name, running] of current) {
          if (!running && previous.get(name) === true) {
            announce(t('operations.live.containerStopped', { name }))
          }
        }
      }
      previous = current
    },
    { immediate: true },
  )
}
