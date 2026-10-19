// Replacing and deleting one DKIM key (US5, research R9, R10, FR-037 to FR-039, FR-090): each asks
// first with what it affects, sends the key's version tag, and after a 412 reads the key again and
// asks again with the fresh values (conventions: a refused deletion is confirmed again). A key that
// vanished says so and refreshes. Outcomes are the classic `success.dkim_added` and
// `success.dkim_removed`, kept as an inline status until the next action.
import { useQueryClient } from '@tanstack/vue-query'
import { ref, shallowRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import {
  isApiProblem,
  queryKeys,
  type ApiProblem,
  type DkimKey,
  type DkimKeyGenerateRequest,
} from '@/api'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import type { SectionStatus } from '@/shared/components/editable-section'
import { announce } from '@/shared/composables/useAnnouncer'
import { confirm } from '@/shared/composables/useConfirm'

import { deleteKey, fetchDkimKey, generateKey } from '../api/dkim'
import DeleteKeyImpact from '../components/DeleteKeyImpact.vue'
import type { GenerationValues } from './useDkimGeneration'

export function useKeyActions(options: {
  entry: Ref<DkimKey | undefined>
  publication: () => boolean
}) {
  const { t, locale } = useI18n()
  const client = useQueryClient()
  const router = useRouter()
  const status = ref<SectionStatus | null>(null)
  const problem = shallowRef<ApiProblem | null>(null)
  const pending = ref(false)
  const replaceOpen = ref(false)
  /** After a replacement while the server does not publish: update the record by hand. */
  const updateRecordNote = ref(false)

  function setStatus(next: SectionStatus | null) {
    status.value = next
    if (next) announce(next.message)
  }

  async function fresh(name: string): Promise<DkimKey | undefined> {
    try {
      const entry = await fetchDkimKey(name)
      client.setQueryData(queryKeys.dkimKeys.detail(name), entry)
      return entry
    } catch {
      return undefined
    }
  }

  function gone(name: string) {
    setStatus({ kind: 'error', message: t('dns.common.gone') })
    void client.invalidateQueries({ queryKey: queryKeys.dkimKeys.detail(name) })
  }

  /** "Replace with a new key": confirm, then generate with overwrite and the version tag. */
  async function replace(values: GenerationValues) {
    let current = options.entry.value
    if (!current?.key || pending.value) return
    replaceOpen.value = false
    pending.value = true
    problem.value = null
    try {
      for (;;) {
        const length = current.key?.keyLength
        const go = await confirm({
          title: t('dns.dkim.replace.title'),
          description: t('dns.dkim.replace.confirm', {
            selector: current.key?.selector ?? '–',
            length: length ? formatNumber(length, locale.value as AppLocale) : '–',
          }),
          confirmLabel: t('dns.dkim.replace.submit'),
          destructive: true,
          content: undefined,
        })
        if (!go) return
        updateRecordNote.value = false
        try {
          const result = await generateKey(
            client,
            {
              name: current.name,
              selector: values.selector,
              keySize: values.keySize as DkimKeyGenerateRequest['keySize'],
              overwrite: true,
            },
            current.etag,
          )
          setStatus({ kind: 'success', message: lt('success.dkim_added', result.name) })
          updateRecordNote.value = !options.publication()
          return
        } catch (error) {
          if (isApiProblem(error) && error.status === 412) {
            const latest = await fresh(current.name)
            if (!latest?.key) return gone(current.name)
            current = latest
            continue
          }
          if (isApiProblem(error) && error.status === 404) return gone(current.name)
          problem.value = isApiProblem(error) ? error : null
          return
        }
      }
    } finally {
      pending.value = false
    }
  }

  /** "Remove": confirm with the impact, then delete with the version tag. */
  async function remove() {
    let current = options.entry.value
    if (!current?.key || !current.etag || pending.value) return
    pending.value = true
    problem.value = null
    try {
      for (;;) {
        const go = await confirm({
          title: lt('footer.confirm_delete'),
          description: lt('footer.delete_these_items'),
          confirmLabel: lt('footer.delete_now'),
          cancelLabel: lt('footer.cancel'),
          destructive: true,
          content: {
            component: DeleteKeyImpact,
            props: { entry: current, publication: options.publication() },
          },
        })
        if (!go) return
        try {
          await deleteKey(client, current, current.etag!)
          setStatus({ kind: 'success', message: lt('success.dkim_removed', current.name) })
          if (current.kind === 'none') {
            await router.push({ name: 'dkim-keys' })
            announce(lt('success.dkim_removed', current.name))
          }
          return
        } catch (error) {
          if (isApiProblem(error) && error.status === 412) {
            const latest = await fresh(current.name)
            if (!latest?.key || !latest.etag) return gone(current.name)
            current = latest
            continue
          }
          if (isApiProblem(error) && error.status === 404) return gone(current.name)
          problem.value = isApiProblem(error) ? error : null
          return
        }
      }
    } finally {
      pending.value = false
    }
  }

  return { status, problem, pending, replaceOpen, updateRecordNote, replace, remove, setStatus }
}
