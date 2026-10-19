// What a user may do with DKIM entries (FR-002, SC-006, data-model §2). Hiding an action is a
// convenience: the API enforces every rule (constitution V). Domain administrators generate keys
// for the names of their scope; everything else on a key is for administrators. Actions that
// depend on a server setting are not offered while the capabilities are unknown.
import type { DkimKey, DnsCapabilities, Role } from '@/api'

export interface DkimActions {
  copyRecord: boolean
  generate: boolean
  replace: boolean
  importOverwrite: boolean
  copyKey: boolean
  delete: boolean
  export: boolean
  exportOffNote: boolean
  publishAgain: boolean
  history: boolean
  checkDns: boolean
}

const manager = (role: Role) => role === 'admin' || role === 'domainAdmin'

export function dkimActions(
  entry: DkimKey,
  role: Role,
  caps: DnsCapabilities | undefined,
): DkimActions {
  const admin = role === 'admin'
  const hasKey = entry.key !== null
  const record = entry.key?.record != null
  const exportSetting = caps?.dkim.privateKeyExportEnabled
  return {
    copyRecord: manager(role) && record,
    generate: manager(role) && entry.state === 'missing',
    replace: admin && hasKey,
    importOverwrite: admin && hasKey,
    // An incomplete key cannot be copied (the API answers 409).
    copyKey: admin && hasKey && entry.key!.complete,
    delete: admin && hasKey,
    export: admin && hasKey && exportSetting === true,
    exportOffNote: admin && hasKey && exportSetting === false,
    publishAgain: admin && record && caps?.dkim.dnsPublicationEnabled === true,
    history: admin,
    checkDns: manager(role) && entry.kind !== 'none',
  }
}

export interface DkimListActions {
  importFromList: boolean
  selectionGenerate: boolean
  selectionDelete: boolean
  filterUnused: boolean
  filterKindNone: boolean
}

export function dkimListActions(role: Role): DkimListActions {
  const admin = role === 'admin'
  return {
    importFromList: admin,
    selectionGenerate: manager(role),
    selectionDelete: admin,
    filterUnused: admin,
    filterKindNone: admin,
  }
}
