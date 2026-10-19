// The allowlist and the denylist as text fields with one entry per line (FR-069, data-model §2
// EntryListModel and §6). Entries are trimmed, empty lines are dropped and duplicates are kept
// once (ignoring letter case), and each sent entry keeps its line, so that an error at
// `denylist.<n>` names its line. The client checks follow `Fail2BanSettingsPatch`; mailcow's
// internal networks are known only to the server.
import { F2B_LIST_ENTRY_MAX_LENGTH } from '@/shared/validation/limits'
import { isIpNetwork } from '@/shared/validation/ip-network'

export interface EntryList {
  entries: string[]
  /** The 1-based line of each entry. */
  lineOf: number[]
}

export type ListName = 'allowlist' | 'denylist'

export interface ListError {
  list: ListName
  /** The entry's index among the sent entries; null for an error about the whole list. */
  index: number | null
  line: number | null
  entry: string | null
  code: 'invalidFormat' | 'reserved' | 'conflictsWith' | 'tooMany' | 'tooLong'
}

const RESERVED = new Set(['0.0.0.0', '0.0.0.0/0', '::/0'])
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i

export function isHostName(value: string): boolean {
  return (
    value.length <= F2B_LIST_ENTRY_MAX_LENGTH &&
    value.split('.').every((label) => LABEL.test(label))
  )
}

export function parseEntries(text: string): EntryList {
  const entries: string[] = []
  const lineOf: number[] = []
  const seen = new Set<string>()
  text.split(/\r?\n/).forEach((raw, index) => {
    const entry = raw.trim()
    if (!entry || seen.has(entry.toLowerCase())) return
    seen.add(entry.toLowerCase())
    entries.push(entry)
    lineOf.push(index + 1)
  })
  return { entries, lineOf }
}

export function checkLists(
  allow: EntryList,
  deny: EntryList,
  limits: { maxEntries: number | null },
): ListError[] {
  const errors: ListError[] = []
  const allowed = new Set(allow.entries.map((entry) => entry.toLowerCase()))
  const check = (list: ListName, model: EntryList) => {
    if (limits.maxEntries !== null && model.entries.length > limits.maxEntries) {
      errors.push({ list, index: null, line: null, entry: null, code: 'tooMany' })
    }
    model.entries.forEach((entry, index) => {
      const at = { list, index, line: model.lineOf[index] ?? null, entry }
      if (entry.length > F2B_LIST_ENTRY_MAX_LENGTH) errors.push({ ...at, code: 'tooLong' })
      else if (list === 'allowlist') {
        if (!isIpNetwork(entry) && !isHostName(entry)) {
          errors.push({ ...at, code: 'invalidFormat' })
        }
      } else if (!isIpNetwork(entry)) errors.push({ ...at, code: 'invalidFormat' })
      else if (RESERVED.has(entry)) errors.push({ ...at, code: 'reserved' })
      else if (allowed.has(entry.toLowerCase())) errors.push({ ...at, code: 'conflictsWith' })
    })
  }
  check('allowlist', allow)
  check('denylist', deny)
  return errors
}
