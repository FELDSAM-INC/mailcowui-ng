// The ban service data layer (UI 011 research R16, data-model §3). Settings and rules carry their
// version tag, which every change sends as `If-Match` (the spec requires it although the contract
// makes it optional). Active and permanent bans are read as legacy shows them, all at once (up to
// the largest page). A ban action replaces the ban in the cached list and refreshes what it
// changed. Nothing is retried on its own.
import { queryOptions, type QueryClient } from '@tanstack/vue-query'

import {
  api,
  isAuditRecorded,
  queryKeys,
  requireData,
  type Fail2BanActiveBan,
  type Fail2BanActiveBanListParams,
  type Fail2BanBanActionResult,
  type Fail2BanPermanentBan,
  type Fail2BanPermanentBanListParams,
  type Fail2BanRules,
  type Fail2BanSettings,
  type Fail2BanSettingsPatch,
  type ListMeta,
} from '@/api'
import { LIST_LIMIT_MAX } from '@/shared/validation/limits'

export interface Recorded<T> {
  result: T
  auditRecorded: boolean
}

export interface BanPage<T> {
  data: T[]
  meta: ListMeta
}

const MERGE_PATCH = { 'Content-Type': 'application/merge-patch+json' }

export const ACTIVE_BAN_PARAMS: Fail2BanActiveBanListParams = {
  limit: LIST_LIMIT_MAX,
  sort: 'endsAt',
  order: 'asc',
}
export const PERMANENT_BAN_PARAMS: Fail2BanPermanentBanListParams = {
  limit: LIST_LIMIT_MAX,
  sort: 'startedAt',
  order: 'desc',
}

export function settingsOptions() {
  return queryOptions({
    queryKey: queryKeys.fail2ban.settings(),
    queryFn: async (): Promise<Fail2BanSettings> =>
      requireData(await api.GET('/fail2ban/settings')).data,
    staleTime: 30_000,
  })
}

export function rulesOptions() {
  return queryOptions({
    queryKey: queryKeys.fail2ban.rules(),
    queryFn: async (): Promise<Fail2BanRules> => requireData(await api.GET('/fail2ban/rules')).data,
    staleTime: 30_000,
  })
}

export function activeBansOptions() {
  return queryOptions({
    queryKey: queryKeys.fail2ban.activeBans(ACTIVE_BAN_PARAMS),
    queryFn: async (): Promise<BanPage<Fail2BanActiveBan>> =>
      requireData(await api.GET('/fail2ban/active-bans', { params: { query: ACTIVE_BAN_PARAMS } })),
    staleTime: 30_000,
  })
}

export function permanentBansOptions() {
  return queryOptions({
    queryKey: queryKeys.fail2ban.permanentBans(PERMANENT_BAN_PARAMS),
    queryFn: async (): Promise<BanPage<Fail2BanPermanentBan>> =>
      requireData(
        await api.GET('/fail2ban/permanent-bans', { params: { query: PERMANENT_BAN_PARAMS } }),
      ),
    staleTime: 30_000,
  })
}

export async function fetchSettings(): Promise<Fail2BanSettings> {
  return requireData(await api.GET('/fail2ban/settings')).data
}

export async function fetchRules(): Promise<Fail2BanRules> {
  return requireData(await api.GET('/fail2ban/rules')).data
}

export async function updateSettings(
  patch: Fail2BanSettingsPatch,
  ifMatch: string,
): Promise<Recorded<Fail2BanSettings>> {
  const result = await api.PATCH('/fail2ban/settings', {
    params: { header: { 'If-Match': ifMatch } },
    body: patch,
    headers: MERGE_PATCH,
  })
  return { result: requireData(result).data, auditRecorded: isAuditRecorded(result.response) }
}

export async function rotateBanListId(ifMatch: string): Promise<Recorded<Fail2BanSettings>> {
  const result = await api.POST('/fail2ban/ban-list-rotation', {
    params: { header: { 'If-Match': ifMatch } },
  })
  return { result: requireData(result).data, auditRecorded: isAuditRecorded(result.response) }
}

export async function replaceRules(
  rules: string[],
  ifMatch: string,
): Promise<Recorded<Fail2BanRules>> {
  const result = await api.PUT('/fail2ban/rules', {
    params: { header: { 'If-Match': ifMatch } },
    body: { rules },
  })
  return { result: requireData(result).data, auditRecorded: isAuditRecorded(result.response) }
}

export async function resetRules(ifMatch: string): Promise<Recorded<Fail2BanRules>> {
  const result = await api.POST('/fail2ban/rules/reset', {
    params: { header: { 'If-Match': ifMatch } },
  })
  return { result: requireData(result).data, auditRecorded: isAuditRecorded(result.response) }
}

export type BanAction = Fail2BanBanActionResult['action']

export async function banAction(
  network: string,
  action: BanAction,
): Promise<Recorded<Fail2BanBanActionResult>> {
  const path = { path: { network } }
  const result =
    action === 'lift'
      ? await api.POST('/fail2ban/active-bans/{network}/lift', { params: path })
      : action === 'allowlist'
        ? await api.POST('/fail2ban/active-bans/{network}/allowlist', { params: path })
        : await api.POST('/fail2ban/active-bans/{network}/denylist', { params: path })
  return { result: requireData(result).data, auditRecorded: isAuditRecorded(result.response) }
}

export function writeSettings(client: QueryClient, settings: Fail2BanSettings): void {
  client.setQueryData(queryKeys.fail2ban.settings(), settings)
}

export function writeRules(client: QueryClient, rules: Fail2BanRules): void {
  client.setQueryData(queryKeys.fail2ban.rules(), rules)
}

/** After a ban action: the ban as returned, and the lists it changed read again. */
export function applyBanResult(client: QueryClient, result: Fail2BanBanActionResult): void {
  client.setQueriesData<BanPage<Fail2BanActiveBan>>(
    { queryKey: queryKeys.fail2ban.activeBanLists() },
    (page) =>
      page
        ? {
            ...page,
            data: page.data.map((ban) => (ban.network === result.ban.network ? result.ban : ban)),
          }
        : page,
  )
  if (result.action !== 'lift') {
    void client.invalidateQueries({ queryKey: queryKeys.fail2ban.settings() })
    void client.invalidateQueries({ queryKey: queryKeys.fail2ban.permanentBanLists() })
  }
}

export function refreshBans(client: QueryClient): Promise<void> {
  return client.invalidateQueries({ queryKey: queryKeys.fail2ban.activeBanLists() })
}
