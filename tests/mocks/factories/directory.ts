// Aliases and alias domains as the list operations of feature 004 return them, built from the mock
// domains (UI 002 US7: the candidates of the footer's exclusions; UI 003 has its mailbox factory). Only the
// members UI 002 reads are meaningful; the rest are minimal valid values from the contract.
import { createHash } from 'node:crypto'
import { domainToUnicode } from 'node:url'

import type { Alias, AliasDomain } from '@/api'

import { contractSample } from './from-contract'

const etag = (value: string) =>
  `"m${createHash('sha256').update(value).digest('hex').slice(0, 23)}"`
const readable = (name: string) => domainToUnicode(name) || name

export function aliasView(id: number, address: string): Alias {
  const domain = address.split('@')[1] ?? ''
  return {
    ...contractSample<Alias>('Alias'),
    id,
    address,
    addressUnicode: address,
    domain,
    domainUnicode: readable(domain),
    primaryDomain: domain,
    primaryDomainUnicode: readable(domain),
    etag: etag(`alias:${address}`),
  }
}

export function aliasDomainView(name: string, target: string): AliasDomain {
  return {
    ...contractSample<AliasDomain>('AliasDomain'),
    name,
    nameUnicode: readable(name),
    targetDomain: target,
    targetDomainUnicode: readable(target),
    etag: etag(`alias-domain:${name}`),
  }
}
