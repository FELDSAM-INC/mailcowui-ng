import type { AccountBulkActionRequest, Admin, BulkTarget } from '@/api'

type SelectedAccount = Pick<Admin, 'username' | 'active' | 'secondFactorStatus' | 'etag'>
export interface BulkPlan {
  targets: BulkTarget[]
  excludedOwn: boolean
  skippedNoSecondFactor: string[]
  blocked: 'lastActiveAdmin' | 'tooMany' | null
  needsConfirmation: 'typedCount' | 'simple' | null
}
/** Safety rules apply before the confirmation, and are checked again immediately before send. */
export function planBulk(input: {
  role: 'admin' | 'domainAdmin'
  action: AccountBulkActionRequest['action']
  selected: readonly SelectedAccount[]
  ownUsername: string
  activeAdminCount: number
  bulkLimit: number
}): BulkPlan {
  const { role, action, ownUsername, activeAdminCount, bulkLimit } = input
  const plan: BulkPlan = {
    targets: [],
    excludedOwn: false,
    skippedNoSecondFactor: [],
    blocked: null,
    needsConfirmation: action === 'delete' ? 'typedCount' : action === 'activate' ? null : 'simple',
  }
  let selected = [
    ...new Map(input.selected.map((item) => [item.username.toLowerCase(), item])).values(),
  ]
  if (role === 'admin' && (action === 'delete' || action === 'deactivate')) {
    const others = selected.filter(
      (item) => item.username.toLowerCase() !== ownUsername.toLowerCase(),
    )
    plan.excludedOwn = others.length !== selected.length
    selected = others
    if (
      selected.filter((item) => item.active).length >= activeAdminCount &&
      selected.some((item) => item.active)
    ) {
      plan.blocked = 'lastActiveAdmin'
      return plan
    }
  }
  if (action === 'suspendSecondFactors') {
    plan.skippedNoSecondFactor = selected
      .filter((item) => item.secondFactorStatus !== 'active')
      .map((item) => item.username)
    selected = selected.filter((item) => item.secondFactorStatus === 'active')
  }
  if (selected.length > bulkLimit) {
    plan.blocked = 'tooMany'
    return plan
  }
  plan.targets = selected.map(({ username, etag }) => ({ id: username, version: etag }))
  return plan
}
