// Links into this feature for other features (data-model §5): the mailbox list, filtered by a
// domain when one is given, and a mailbox.
import type { RouteLocationRaw } from 'vue-router'

export function mailboxListLink(options: { domain?: string } = {}): RouteLocationRaw {
  return { name: 'mailboxes', query: options.domain ? { domain: options.domain } : {} }
}

export function mailboxLink(address: string): RouteLocationRaw {
  return { name: 'mailbox-detail', params: { address } }
}

/** The add mailbox form with a domain chosen. */
export function mailboxCreateLink(options: { domain?: string } = {}): RouteLocationRaw {
  return { name: 'mailbox-create', query: options.domain ? { domain: options.domain } : {} }
}
