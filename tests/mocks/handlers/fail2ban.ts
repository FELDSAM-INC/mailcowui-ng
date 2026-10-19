// Ban service handlers (UI 011 T014, T100): the settings with their version tag (`If-Match`, 412)
// and the documented rules of a merge patch; the rules (replace with their checks, reset); the ban
// list ID rotation; active bans with lifting, allowlisting and denylisting (404 for an ended ban);
// permanent bans. Every operation honours the scenario's injections.
import { randomUUID } from 'node:crypto'

import type {
  Fail2BanActiveBan,
  Fail2BanPermanentBan,
  Fail2BanRules,
  Fail2BanSettings,
  Fail2BanSettingsPatch,
} from '@/api'
import { isIpNetwork } from '@/shared/validation/ip-network'

import {
  defaultRules,
  rulesEtag,
  settingsEtag,
  type MockActiveBan,
  type MockFail2banSettings,
} from '../factories/fail2ban'
import type { ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem } from './context'
import { addViolation, compareValues, validationFailed, type Violations } from './domain-rules'
import { operationGate } from './operations-context'

const outdated = () => problem(412, null)
const notFound = () => problem(404, null)

const MAX_NUMBER = 2_147_483_647
const RANGES: Record<string, [number, number]> = {
  banTime: [60, MAX_NUMBER],
  maxBanTime: [60, MAX_NUMBER],
  maxAttempts: [1, MAX_NUMBER],
  retryWindow: [1, MAX_NUMBER],
  ipv4PrefixLength: [8, 32],
  ipv6PrefixLength: [8, 128],
}
const RESERVED = new Set(['0.0.0.0', '0.0.0.0/0', '::/0', '172.22.1.0/24', '172.22.1.0'])
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i

function isHostName(value: string): boolean {
  return value.length <= 253 && value.split('.').every((label) => LABEL.test(label))
}

function data(state: ScenarioState) {
  return state.operations.fail2ban
}

function settingsView(state: ScenarioState): Fail2BanSettings {
  const { settings, banServiceRunning } = data(state)
  return { ...settings, banServiceRunning, etag: settingsEtag(settings) }
}

function rulesView(state: ScenarioState): Fail2BanRules {
  const { rules, rulesStored, banServiceRunning } = data(state)
  return {
    rules: rules.map((pattern, index) => ({ number: index + 1, pattern })),
    stored: rulesStored,
    banServiceRunning,
    etag: rulesEtag(rules),
  }
}

function banView(state: ScenarioState, ban: MockActiveBan): Fail2BanActiveBan {
  return {
    ...ban,
    remainingSeconds: Math.max(0, Math.round((Date.parse(ban.endsAt) - state.now()) / 1000)),
  }
}

/** Trimmed entries, duplicates once. */
function normalList(entries: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of entries) {
    const entry = raw.trim()
    if (!entry || seen.has(entry.toLowerCase())) continue
    seen.add(entry.toLowerCase())
    result.push(entry)
  }
  return result
}

function checkList(
  errors: Violations,
  field: 'allowlist' | 'denylist',
  entries: readonly string[],
  max: number,
) {
  if (entries.length > max) addViolation(errors, field, 'tooMany', { max })
  entries.forEach((entry, index) => {
    const path = `${field}.${index}`
    if (entry.length > 253) {
      addViolation(errors, path, 'tooLong', { max: 253 })
      return
    }
    if (field === 'allowlist') {
      if (!isIpNetwork(entry) && !isHostName(entry)) {
        addViolation(errors, path, 'invalidFormat', { format: 'ipNetworkOrHostname' })
      }
    } else if (!isIpNetwork(entry)) {
      addViolation(errors, path, 'invalidFormat', { format: 'ipNetwork' })
    } else if (RESERVED.has(entry)) {
      addViolation(errors, path, 'reserved', { reserved: entry })
    }
  })
}

function validatePatch(
  state: ScenarioState,
  stored: MockFail2banSettings,
  patch: Fail2BanSettingsPatch,
): { errors: Violations; next: MockFail2banSettings } {
  const errors: Violations = {}
  const next: MockFail2banSettings = { ...stored }
  for (const [field, [min, max]] of Object.entries(RANGES)) {
    const value = (patch as Record<string, unknown>)[field]
    if (value === undefined) continue
    const key = field as keyof MockFail2banSettings
    if (value !== stored[key] && (typeof value !== 'number' || value < min || value > max)) {
      addViolation(errors, field, 'outOfRange', { min, max })
    }
    ;(next as unknown as Record<string, unknown>)[field] = value
  }
  if (patch.maxBanTime !== undefined && next.maxBanTime < next.banTime) {
    addViolation(errors, 'maxBanTime', 'outOfRange', {
      min: next.banTime,
      max: MAX_NUMBER,
      minField: 'banTime',
    })
  } else if (patch.banTime !== undefined && patch.maxBanTime === undefined) {
    if (next.banTime > next.maxBanTime) {
      addViolation(errors, 'banTime', 'mustNotExceed', {
        field: 'maxBanTime',
        value: next.maxBanTime,
      })
    }
  }
  if (patch.banTimeIncrement !== undefined) next.banTimeIncrement = patch.banTimeIncrement
  if (patch.externallyEnforced !== undefined) next.externallyEnforced = patch.externallyEnforced
  const max = state.operations.capabilities.limits.fail2banListMaxEntries
  if (patch.allowlist !== undefined) {
    next.allowlist = normalList(patch.allowlist)
    checkList(errors, 'allowlist', next.allowlist, max)
  }
  if (patch.denylist !== undefined) {
    next.denylist = normalList(patch.denylist)
    checkList(errors, 'denylist', next.denylist, max)
  }
  const allowed = new Set(next.allowlist.map((entry) => entry.toLowerCase()))
  if (patch.denylist !== undefined) {
    next.denylist.forEach((entry, index) => {
      if (allowed.has(entry.toLowerCase())) {
        addViolation(errors, `denylist.${index}`, 'conflictsWith', {
          field: 'allowlist',
          value: entry,
        })
      }
    })
  } else if (patch.allowlist !== undefined) {
    const denied = new Set(next.denylist.map((entry) => entry.toLowerCase()))
    next.allowlist.forEach((entry, index) => {
      if (denied.has(entry.toLowerCase())) {
        addViolation(errors, `allowlist.${index}`, 'conflictsWith', {
          field: 'denylist',
          value: entry,
        })
      }
    })
  }
  return { errors, next }
}

function syncPermanentBans(state: ScenarioState) {
  const area = data(state)
  const keep = area.permanentBans.filter((ban) =>
    area.settings.denylist.some((entry) => ban.network === entry || ban.address === entry),
  )
  for (const entry of area.settings.denylist) {
    if (keep.some((ban) => ban.network === entry || ban.address === entry)) continue
    keep.push({
      network: entry.includes('/') ? entry : `${entry}/${entry.includes(':') ? 128 : 32}`,
      address: entry.split('/')[0]!,
      startedAt: new Date(state.now()).toISOString(),
    })
  }
  area.permanentBans = keep
}

function compileProblem(pattern: string): string | null {
  try {
    new RegExp(pattern.replace(/\(\?P<([a-z_]+)>/gi, '(?<$1>'))
    return null
  } catch (error) {
    return error instanceof Error ? error.message : 'invalid'
  }
}

function hasCaptureGroup(pattern: string): boolean {
  try {
    return (new RegExp(`${pattern}|`).exec('')?.length ?? 1) > 1
  } catch {
    return false
  }
}

const settingsAnswer = (state: ScenarioState) => {
  const view = settingsView(state)
  return { body: { data: view }, init: { headers: { ETag: view.etag } } }
}

export const fail2banHandlers = [
  http.get('/fail2ban/settings', async ({ response }) => {
    const gate = await operationGate('getFail2BanSettings')
    if (gate.stop) return response.untyped(gate.stop)
    const answer = settingsAnswer(gate.state)
    return gate.finish(response(200).json(answer.body, answer.init))
  }),

  http.patch('/fail2ban/settings', async ({ request, response }) => {
    const gate = await operationGate('updateFail2BanSettings')
    if (gate.stop) return response.untyped(gate.stop)
    const refused = csrfProblem(gate.state, request)
    if (refused) return response.untyped(refused)
    const area = data(gate.state)
    if (area.changeBeforeSave) {
      area.settings = { ...area.settings, ...area.changeBeforeSave }
      area.changeBeforeSave = null
    }
    const ifMatch = request.headers.get('if-match')
    if (ifMatch !== null && ifMatch !== settingsEtag(area.settings)) {
      return response.untyped(outdated())
    }
    const patch = await request.json()
    const { errors, next } = validatePatch(gate.state, area.settings, patch)
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    area.settings = { ...next, stored: true }
    if (patch.denylist !== undefined) syncPermanentBans(gate.state)
    const answer = settingsAnswer(gate.state)
    return gate.finish(response(200).json(answer.body, answer.init))
  }),

  http.post('/fail2ban/ban-list-rotation', async ({ request, response }) => {
    const gate = await operationGate('rotateFail2BanBanListId')
    if (gate.stop) return response.untyped(gate.stop)
    const refused = csrfProblem(gate.state, request)
    if (refused) return response.untyped(refused)
    const area = data(gate.state)
    const ifMatch = request.headers.get('if-match')
    if (ifMatch !== null && ifMatch !== settingsEtag(area.settings)) {
      return response.untyped(outdated())
    }
    const id = randomUUID()
    area.settings = {
      ...area.settings,
      banListId: id,
      banListUrl: `https://mail.example.org/f2b-banlist?id=${id}`,
    }
    const answer = settingsAnswer(gate.state)
    return gate.finish(response(200).json(answer.body, answer.init))
  }),

  http.get('/fail2ban/rules', async ({ response }) => {
    const gate = await operationGate('getFail2BanRules')
    if (gate.stop) return response.untyped(gate.stop)
    const view = rulesView(gate.state)
    return gate.finish(response(200).json({ data: view }, { headers: { ETag: view.etag } }))
  }),

  http.put('/fail2ban/rules', async ({ request, response }) => {
    const gate = await operationGate('replaceFail2BanRules')
    if (gate.stop) return response.untyped(gate.stop)
    const refused = csrfProblem(gate.state, request)
    if (refused) return response.untyped(refused)
    const area = data(gate.state)
    const ifMatch = request.headers.get('if-match')
    if (ifMatch !== null && ifMatch !== rulesEtag(area.rules)) return response.untyped(outdated())
    const body = await request.json()
    const errors: Violations = {}
    const limits = gate.state.operations.capabilities.limits
    if (body.rules.length === 0) addViolation(errors, 'rules', 'required')
    if (body.rules.length > limits.fail2banRulesMax) {
      addViolation(errors, 'rules', 'tooMany', { max: limits.fail2banRulesMax })
    }
    body.rules.forEach((pattern, index) => {
      const path = `rules.${index}`
      if (pattern.length === 0) return addViolation(errors, path, 'tooShort', { min: 1 })
      if (pattern.length > limits.fail2banRuleMaxLength) {
        return addViolation(errors, path, 'tooLong', { max: limits.fail2banRuleMaxLength })
      }
      const compileError = compileProblem(pattern)
      if (compileError) return addViolation(errors, path, 'invalidRegex', { error: compileError })
      if (!hasCaptureGroup(pattern)) addViolation(errors, path, 'missingCaptureGroup')
    })
    if (Object.keys(errors).length > 0) return response.untyped(validationFailed(errors))
    area.rules = [...body.rules]
    area.rulesStored = true
    const view = rulesView(gate.state)
    return gate.finish(response(200).json({ data: view }, { headers: { ETag: view.etag } }))
  }),

  http.post('/fail2ban/rules/reset', async ({ request, response }) => {
    const gate = await operationGate('resetFail2BanRules')
    if (gate.stop) {
      // The stored rules were removed even though the defaults did not come back in time.
      if (gate.stop.status === 504) {
        data(gate.state).rules = defaultRules()
        data(gate.state).rulesStored = false
      }
      return response.untyped(gate.stop)
    }
    const refused = csrfProblem(gate.state, request)
    if (refused) return response.untyped(refused)
    const area = data(gate.state)
    const ifMatch = request.headers.get('if-match')
    if (ifMatch !== null && ifMatch !== rulesEtag(area.rules)) return response.untyped(outdated())
    area.rules = defaultRules()
    area.rulesStored = false
    const view = rulesView(gate.state)
    return gate.finish(response(200).json({ data: view }, { headers: { ETag: view.etag } }))
  }),

  http.get('/fail2ban/active-bans', async ({ request, response }) => {
    const gate = await operationGate('listFail2BanActiveBans')
    if (gate.stop) return response.untyped(gate.stop)
    const area = data(gate.state)
    // The ban service lifts a ban queued through the API once the list has been read again after
    // `liftAfterReads` reads (about 10 seconds in reality); seeded pending bans stay pending.
    for (const ban of area.activeBans) {
      if (ban.queuedForLifting && ban.network in area.liftReads) area.liftReads[ban.network]! += 1
    }
    if (area.banServiceRunning !== false) {
      area.activeBans = area.activeBans.filter(
        (ban) =>
          !ban.queuedForLifting ||
          !(ban.network in area.liftReads) ||
          area.liftReads[ban.network]! <= area.liftAfterReads,
      )
    }
    const url = new URL(request.url)
    const params = url.searchParams
    const q = params.get('q')?.toLowerCase()
    const queued = params.get('queuedForLifting')
    const sort = params.get('sort') ?? 'endsAt'
    const direction = (params.get('order') ?? 'asc') === 'desc' ? -1 : 1
    const items = area.activeBans
      .filter((ban) => !q || ban.network.toLowerCase().includes(q))
      .filter((ban) => queued === null || String(ban.queuedForLifting) === queued)
      .sort(
        (a, b) =>
          direction *
            (sort === 'network'
              ? compareValues(a.network, b.network)
              : Date.parse(a.endsAt) - Date.parse(b.endsAt)) || compareValues(a.network, b.network),
      )
    const limit = Number(params.get('limit') ?? 25)
    const offset = Number(params.get('offset') ?? 0)
    return gate.finish(
      response(200).json({
        data: items.slice(offset, offset + limit).map((ban) => banView(gate.state, ban)),
        meta: { total: items.length, limit, offset },
      }),
    )
  }),

  ...(['lift', 'allowlist', 'denylist'] as const).map((action) =>
    http.post(
      `/fail2ban/active-bans/{network}/${action}`,
      async ({ params, request, response }) => {
        const operationId = {
          lift: 'liftFail2BanBan',
          allowlist: 'allowlistFail2BanBan',
          denylist: 'denylistFail2BanBan',
        }[action]
        const gate = await operationGate(operationId)
        if (gate.stop) return response.untyped(gate.stop)
        const refused = csrfProblem(gate.state, request)
        if (refused) return response.untyped(refused)
        const area = data(gate.state)
        const network = decodeURIComponent(String(params.network))
        const ban = area.activeBans.find((item) => item.network === network)
        if (!ban) return response.untyped(notFound())
        const max = gate.state.operations.capabilities.limits.fail2banListMaxEntries
        const settings = area.settings
        if (action === 'denylist') {
          if (RESERVED.has(network)) {
            const errors: Violations = {}
            addViolation(errors, 'network', 'reserved', { reserved: network })
            return response.untyped(validationFailed(errors))
          }
          if (settings.denylist.length >= max) {
            const errors: Violations = {}
            addViolation(errors, 'network', 'tooMany', { max })
            return response.untyped(validationFailed(errors))
          }
          area.settings = {
            ...settings,
            denylist: normalList([...settings.denylist, network]),
            allowlist: settings.allowlist.filter((entry) => entry !== network),
            stored: true,
          }
          syncPermanentBans(gate.state)
        } else {
          if (action === 'allowlist') {
            if (settings.allowlist.length >= max) {
              const errors: Violations = {}
              addViolation(errors, 'network', 'tooMany', { max })
              return response.untyped(validationFailed(errors))
            }
            area.settings = {
              ...settings,
              allowlist: normalList([...settings.allowlist, network]),
              denylist: settings.denylist.filter((entry) => entry !== network),
              stored: true,
            }
            syncPermanentBans(gate.state)
          }
          ban.queuedForLifting = true
          area.liftReads[ban.network] = 0
        }
        return gate.finish(
          response(200).json({
            data: {
              action,
              ban: banView(gate.state, ban),
              banServiceRunning: area.banServiceRunning,
            },
          }),
        )
      },
    ),
  ),

  http.get('/fail2ban/permanent-bans', async ({ request, response }) => {
    const gate = await operationGate('listFail2BanPermanentBans')
    if (gate.stop) return response.untyped(gate.stop)
    const url = new URL(request.url)
    const params = url.searchParams
    const q = params.get('q')?.toLowerCase()
    const items: Fail2BanPermanentBan[] = data(gate.state)
      .permanentBans.filter((ban) => !q || ban.network.toLowerCase().includes(q))
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    const limit = Number(params.get('limit') ?? 25)
    const offset = Number(params.get('offset') ?? 0)
    return gate.finish(
      response(200).json({
        data: items.slice(offset, offset + limit),
        meta: { total: items.length, limit, offset },
      }),
    )
  }),
]
