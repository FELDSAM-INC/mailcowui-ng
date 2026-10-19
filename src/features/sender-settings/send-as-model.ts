// The "Allow to send as" and "External sender addresses" fields of the classic mailbox page
// (`templates/edit/mailbox.twig`, `mailbox_get_sender_acl_handles()`; legacy form map, part 3
// item 1) as pure functions over the API's sender settings:
// - the multi-select's selected entries: the explicit permissions (`*` and domains labelled with
//   `edit.dont_check_sender_acl`), marked "Admin" when the user cannot change them, "Alias" for an
//   alias address, and stale ones; then the aliases that deliver to the mailbox and allow sending,
//   selected and locked ("Alias (allowed)"), as legacy shows them;
// - the options legacy adds: the aliases that deliver to the mailbox without allowing sending
//   ("Alias (blocked)"); choosing one grants the explicit permission;
// - the patch: each changed set whole (compared ignoring order and letter case, as legacy stores
//   rows), with `If-Match`; `*` alone.
// Catch-all aliases, the own address and the alias-domain addresses are not shown, as in legacy.
import type {
  MailboxSenderPermission,
  MailboxSenderSettings,
  MailboxSenderSettingsPatch,
} from '@/api'
import { joinEntries, parseEntryList } from '@/shared/validation/entry-list'

export type SenderEntry = Pick<
  MailboxSenderPermission,
  'value' | 'valueUnicode' | 'type' | 'kind' | 'changeable' | 'stale'
>

export interface SenderWorkingCopy {
  explicit: SenderEntry[]
  externalText: string
}

/** Legacy's subtexts of the multi-select (`data-subtext`), plus the API's stale marker. */
export type SenderSubtext = 'admin' | 'alias' | 'aliasAllowed' | 'aliasBlocked' | 'stale'

export interface SelectedEntry {
  value: string
  valueUnicode: string
  type: SenderEntry['type']
  subtext: SenderSubtext | null
  removable: boolean
}

const key = (value: string) => value.trim().toLowerCase()

export function toWorkingCopy(settings: MailboxSenderSettings): SenderWorkingCopy {
  return {
    explicit: settings.explicitPermissions.map((entry) => ({ ...entry })),
    externalText: joinEntries(settings.externalSenderAddresses),
  }
}

function fixedAliases(settings: MailboxSenderSettings, allowed: boolean) {
  return settings.implicitAddresses.filter(
    (entry) => entry.source === 'alias' && !entry.catchAll && entry.senderAllowed === allowed,
  )
}

export function selectedEntries(
  settings: MailboxSenderSettings,
  copy: SenderWorkingCopy,
): SelectedEntry[] {
  const explicit = copy.explicit.map((entry): SelectedEntry => ({
    value: entry.value,
    valueUnicode: entry.valueUnicode,
    type: entry.type,
    subtext: !entry.changeable
      ? 'admin'
      : entry.stale
        ? 'stale'
        : entry.kind === 'alias'
          ? 'alias'
          : null,
    removable: entry.changeable,
  }))
  const taken = new Set(copy.explicit.map((entry) => key(entry.value)))
  const allowed = fixedAliases(settings, true)
    .filter((entry) => !taken.has(key(entry.address)))
    .map((entry) => ({
      value: entry.address,
      valueUnicode: entry.addressUnicode,
      type: 'address' as const,
      subtext: 'aliasAllowed' as const,
      removable: false,
    }))
  return [...explicit, ...allowed]
}

/** The aliases that deliver to the mailbox but do not allow sending, not yet granted. */
export function blockedAliases(
  settings: MailboxSenderSettings,
  copy: SenderWorkingCopy,
): SelectedEntry[] {
  const taken = new Set(copy.explicit.map((entry) => key(entry.value)))
  return fixedAliases(settings, false)
    .filter((entry) => !taken.has(key(entry.address)))
    .map((entry) => ({
      value: entry.address,
      valueUnicode: entry.addressUnicode,
      type: 'address' as const,
      subtext: 'aliasBlocked' as const,
      removable: true,
    }))
}

const sameSet = (a: readonly string[], b: readonly string[]) => {
  const left = new Set(a.map(key))
  const right = new Set(b.map(key))
  return left.size === right.size && [...left].every((value) => right.has(value))
}

/** Each changed set, whole (FR-054); `*` is stored alone; null when nothing changed. */
export function buildSenderPatch(
  read: MailboxSenderSettings,
  copy: SenderWorkingCopy,
): MailboxSenderSettingsPatch | null {
  const patch: MailboxSenderSettingsPatch = {}
  const values = copy.explicit.map((entry) => entry.value)
  const stored = read.explicitPermissions.map((entry) => entry.value)
  if (!sameSet(values, stored)) {
    patch.explicitPermissions = values.some((value) => value === '*') ? ['*'] : values
  }
  const external = parseEntryList(copy.externalText).map((entry) => entry.value)
  if (!sameSet(external, read.externalSenderAddresses)) {
    patch.externalSenderAddresses = external
  }
  return Object.keys(patch).length > 0 ? patch : null
}

/** The value sent at `explicitPermissions.N` or `externalSenderAddresses.N`. */
export function entryForPath(
  path: string,
  sent: Pick<MailboxSenderSettingsPatch, 'explicitPermissions' | 'externalSenderAddresses'>,
): string | undefined {
  const match = /^(explicitPermissions|externalSenderAddresses)\.(\d+)$/.exec(path)
  if (!match) return undefined
  return sent[match[1] as 'explicitPermissions' | 'externalSenderAddresses']?.[Number(match[2])]
}

/**
 * The added entries the server dropped because an alias that delivers to the mailbox already
 * allows sending as them (FR-055).
 */
export function notNeededAfterSave(
  added: readonly string[],
  response: MailboxSenderSettings,
): string[] {
  const stored = new Set(response.explicitPermissions.map((entry) => key(entry.value)))
  const allowed = new Set(fixedAliases(response, true).map((entry) => key(entry.address)))
  return added.filter((value) => !stored.has(key(value)) && allowed.has(key(value)))
}
