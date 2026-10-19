// The owner of allow and block list entries (UI 006 research R19, data-model §2 "PolicyOwner",
// legacy form map D9): a domain, an alias domain or a mailbox. Its kind selects the list, create and
// delete operations, the host page whose "Spam filter" section shows its lists (opened at
// `#spam-filter`), the section's legacy title, and legacy's messages of its outcomes (form map part
// 2: `functions.policy.inc.php`).
import type { RouteLocationRaw } from 'vue-router'

import {
  api,
  requireData,
  type ListMeta,
  type SpamPolicyEntry,
  type SpamPolicyEntryCreateRequest,
  type SpamPolicyEntryListParams,
  type SpamPolicyOwnerKind,
} from '@/api'
import type { LegacyKey } from '@/i18n'

export type PolicyOwnerKind = SpamPolicyOwnerKind

export interface PolicyOwner {
  kind: PolicyOwnerKind
  /** Domain name (ASCII), alias domain name or mailbox address. */
  name: string
}

export interface EntryPage {
  data: SpamPolicyEntry[]
  meta: ListMeta
}

/** The fragment of the host pages' spam filter section. */
export const SPAM_FILTER_HASH = '#spam-filter'

const HOST: Record<PolicyOwnerKind, { route: string; param: string }> = {
  domain: { route: 'domain-detail', param: 'domain' },
  aliasDomain: { route: 'alias-domain-detail', param: 'aliasDomain' },
  mailbox: { route: 'mailbox-detail', param: 'address' },
}

/** The owner's page, at its spam filter section. */
export function hostLocation(owner: PolicyOwner): RouteLocationRaw {
  const host = HOST[owner.kind]
  return { name: host.route, params: { [host.param]: owner.name }, hash: SPAM_FILTER_HASH }
}

/** Legacy's `#dspamfilter` tab title on domains; the user page's title on mailboxes (D22). */
export const SECTION_TITLE_KEY: Record<PolicyOwnerKind, LegacyKey> = {
  domain: 'edit.spam_filter',
  aliasDomain: 'edit.spam_filter',
  mailbox: 'user.spamfilter',
}

/** An entry was added (one `%s`: the owner). */
export const CREATED_KEY: Record<PolicyOwnerKind, LegacyKey> = {
  domain: 'success.domain_modified',
  aliasDomain: 'success.aliasd_modified',
  mailbox: 'success.mailbox_modified',
}

/** An entry was removed (one `%s`: the entry's ID). */
export const REMOVED_KEY: Record<PolicyOwnerKind, LegacyKey> = {
  domain: 'success.item_deleted',
  aliasDomain: 'success.item_deleted',
  mailbox: 'success.items_deleted',
}

export interface OwnerOperations {
  list(name: string, query: SpamPolicyEntryListParams): Promise<EntryPage>
  create(name: string, body: SpamPolicyEntryCreateRequest): Promise<SpamPolicyEntry>
  remove(name: string, entryId: number, ifMatch: string): Promise<void>
}

const OPERATIONS: Record<PolicyOwnerKind, OwnerOperations> = {
  domain: {
    list: async (domain, query) =>
      requireData(
        await api.GET('/domains/{domain}/spam-policy-entries', {
          params: { path: { domain }, query },
        }),
      ),
    create: async (domain, body) =>
      requireData(
        await api.POST('/domains/{domain}/spam-policy-entries', {
          params: { path: { domain } },
          body,
        }),
      ).data,
    remove: async (domain, entryId, ifMatch) => {
      await api.DELETE('/domains/{domain}/spam-policy-entries/{entryId}', {
        params: { path: { domain, entryId }, header: { 'If-Match': ifMatch } },
      })
    },
  },
  aliasDomain: {
    list: async (aliasDomain, query) =>
      requireData(
        await api.GET('/alias-domains/{aliasDomain}/spam-policy-entries', {
          params: { path: { aliasDomain }, query },
        }),
      ),
    create: async (aliasDomain, body) =>
      requireData(
        await api.POST('/alias-domains/{aliasDomain}/spam-policy-entries', {
          params: { path: { aliasDomain } },
          body,
        }),
      ).data,
    remove: async (aliasDomain, entryId, ifMatch) => {
      await api.DELETE('/alias-domains/{aliasDomain}/spam-policy-entries/{entryId}', {
        params: { path: { aliasDomain, entryId }, header: { 'If-Match': ifMatch } },
      })
    },
  },
  mailbox: {
    list: async (mailbox, query) =>
      requireData(
        await api.GET('/mailboxes/{mailbox}/spam-policy-entries', {
          params: { path: { mailbox }, query },
        }),
      ),
    create: async (mailbox, body) =>
      requireData(
        await api.POST('/mailboxes/{mailbox}/spam-policy-entries', {
          params: { path: { mailbox } },
          body,
        }),
      ).data,
    remove: async (mailbox, entryId, ifMatch) => {
      await api.DELETE('/mailboxes/{mailbox}/spam-policy-entries/{entryId}', {
        params: { path: { mailbox, entryId }, header: { 'If-Match': ifMatch } },
      })
    },
  },
}

/** The list, create and delete operations of an owner kind. */
export function ownerOperations(kind: PolicyOwnerKind): OwnerOperations {
  return OPERATIONS[kind]
}
