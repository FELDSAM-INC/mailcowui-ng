// Generating DKIM keys (US2, research R8): one name from its entry or the domain page's section, or
// a run over a selection or every name without a key, one request per name through UI 004's
// `useSequentialCreate` with the DKIM refusal classifier. A run keeps its rows for the results and
// "Retry"; a single generation reports a refusal in the dialog and keeps the input.
import { useQueryClient } from '@tanstack/vue-query'
import { ref, shallowRef } from 'vue'

import {
  isApiProblem,
  type ApiProblem,
  type DkimKeyChangeResult,
  type DkimKeyGenerateRequest,
} from '@/api'
import { lt } from '@/i18n'
import { announce } from '@/shared/composables/useAnnouncer'
import { useSequentialCreate } from '@/shared/composables/useSequentialCreate'

import { generateKey } from '../api/dkim'
import { dkimRunClassifier, runRows, type RunName, type RunRow } from '../dkim/generate-run'

export interface GenerationValues {
  selector: string
  keySize: number
}

/** A run over several names. */
export function useDkimRun() {
  const client = useQueryClient()
  const runner = useSequentialCreate<DkimKeyChangeResult>()
  const rows = shallowRef<RunRow[]>([])
  const labels = new Map<string, string>()
  let values: GenerationValues | null = null

  async function start(
    names: readonly RunName[],
    skipped: readonly RunName[],
    next: GenerationValues,
  ) {
    values = next
    for (const item of [...names, ...skipped]) labels.set(item.name, item.label)
    rows.value = []
    const results = await runner.run(
      names.map((item, index) => ({ value: item.name, index })),
      (entry) =>
        generateKey(client, {
          name: entry.value,
          selector: next.selector,
          keySize: next.keySize as DkimKeyGenerateRequest['keySize'],
          overwrite: false,
        }),
      dkimRunClassifier,
    )
    rows.value = runRows(results, skipped, (name) => labels.get(name) ?? name)
    return rows.value
  }

  /** Sends the refused, unknown and not processed names again with the same values. */
  function retry(names: readonly string[]) {
    if (!values) return Promise.resolve([])
    return start(
      names.map((name) => ({ name, label: labels.get(name) ?? name })),
      [],
      values,
    )
  }

  function reset() {
    runner.reset()
    rows.value = []
  }

  return {
    rows,
    running: runner.running,
    current: runner.current,
    total: runner.total,
    stopProblem: runner.stopProblem,
    start,
    retry,
    stop: runner.stop,
    reset,
  }
}

/** One name: the dialog stays open with its input after a refusal. */
export function useSingleGeneration(onDone: (result: DkimKeyChangeResult) => void) {
  const client = useQueryClient()
  const open = ref(false)
  const pending = ref(false)
  const problem = shallowRef<ApiProblem | null>(null)
  const names = shallowRef<RunName[]>([])

  function start(name: RunName) {
    names.value = [name]
    problem.value = null
    open.value = true
  }

  async function submit(values: GenerationValues) {
    const name = names.value[0]
    if (!name || pending.value) return
    pending.value = true
    problem.value = null
    try {
      const result = await generateKey(client, {
        name: name.name,
        selector: values.selector,
        keySize: values.keySize as DkimKeyGenerateRequest['keySize'],
        overwrite: false,
      })
      open.value = false
      announce(lt('success.dkim_added', result.name))
      onDone(result)
    } catch (error) {
      problem.value = isApiProblem(error) ? error : null
    } finally {
      pending.value = false
    }
  }

  return { open, pending, problem, names, start, submit }
}
