import type { GroupPatch, MailboxGroup } from './api'

export interface GroupForm {
  domain: string
  name: string
  description: string
  address: string
  active: boolean
  senderAllowed: boolean
  sogoVisible: boolean
  internal: boolean
  members: string[]
  sendAs: string
  imapGrants: NonNullable<GroupPatch['imapGrants']>
  sogoGrants: NonNullable<GroupPatch['sogoGrants']>
  templateId: number | null
  priority: number
  identityReference: string
}
export function groupForm(group?: MailboxGroup): GroupForm {
  return {
    domain: group?.domain ?? '',
    name: group?.name ?? '',
    description: group?.description ?? '',
    address: group?.address ?? '',
    active: group?.active ?? true,
    senderAllowed: group?.senderAllowed ?? false,
    sogoVisible: group?.sogoVisible ?? false,
    internal: group?.internal ?? false,
    members: group?.members.filter((m) => m.editable).map((m) => m.mailbox) ?? [],
    sendAs: group?.sendAs.join('\n') ?? '',
    imapGrants:
      group?.imapGrants
        .filter((g) => g.state !== 'removing')
        .map(({ owner, rights, subscribe }) => ({ owner, rights, subscribe })) ?? [],
    sogoGrants:
      group?.sogoGrants.map(({ owner, type, folder, access, subscribe }) => ({
        owner,
        type,
        folder,
        access,
        subscribe,
      })) ?? [],
    templateId: group?.templateId ?? null,
    priority: group?.priority ?? 0,
    identityReference: group?.identityReference ?? '',
  }
}
export function groupValues(form: GroupForm, admin: boolean): GroupPatch {
  return {
    name: form.name.trim(),
    description: form.description,
    address: form.address.trim() || null,
    active: form.active,
    senderAllowed: form.senderAllowed,
    sogoVisible: form.sogoVisible,
    internal: form.internal,
    members: [...form.members],
    sendAs: [...new Set(form.sendAs.split(/[\s,;]+/).filter(Boolean))],
    imapGrants: form.imapGrants,
    sogoGrants: form.sogoGrants,
    ...(admin
      ? {
          templateId: form.templateId,
          priority: form.priority,
          identityReference: form.identityReference.trim() || null,
        }
      : {}),
  }
}
/** Relations are compared structurally, never stringified as an unordered set of objects. */
export function groupPatch(form: GroupForm, opened: MailboxGroup, admin: boolean): GroupPatch {
  const from = groupValues(groupForm(opened), admin)
  return Object.fromEntries(
    Object.entries(groupValues(form, admin)).filter(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(from[key as keyof GroupPatch]),
    ),
  )
}
export function groupFieldId(path: string) {
  return `group-${path.startsWith('members.') ? 'members' : path.startsWith('sendAs.') ? 'sendAs' : path.replaceAll('.', '-')}`
}
