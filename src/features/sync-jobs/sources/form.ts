import type { SourcePatch, SyncSource } from './api'
export interface SourceForm {
  name: string
  description: string
  remoteHost: string
  remotePort: number
  encryption: SyncSource['encryption']
  authMechanism: SyncSource['authMechanism']
  scope: SyncSource['scope']
  domains: string[]
  users: string[]
  verifyCertificate: boolean
  active: boolean
  oauth: {
    flow: 'client_credentials' | 'authorization_code'
    tokenEndpoint: string
    authorizationEndpoint: string
    userInfoEndpoint: string
    clientId: string
    clientSecret: string
    scope: string
    extraParameters: string
  }
}
export function sourceForm(source?: SyncSource): SourceForm {
  return {
    name: source?.name ?? '',
    description: source?.description ?? '',
    remoteHost: source?.remoteHost ?? '',
    remotePort: source?.remotePort ?? 993,
    encryption: source?.encryption ?? 'ssl',
    authMechanism: source?.authMechanism ?? 'plain',
    scope: source?.scope ?? 'user',
    domains: [...(source?.domains ?? [])],
    users: [...(source?.users ?? [])],
    verifyCertificate: source?.verifyCertificate ?? true,
    active: source?.active ?? true,
    oauth: {
      flow: source?.oauth?.flow ?? 'authorization_code',
      tokenEndpoint: source?.oauth?.tokenEndpoint ?? '',
      authorizationEndpoint: source?.oauth?.authorizationEndpoint ?? '',
      userInfoEndpoint: source?.oauth?.userInfoEndpoint ?? '',
      clientId: source?.oauth?.clientId ?? '',
      clientSecret: '',
      scope: source?.oauth?.scope ?? '',
      extraParameters: JSON.stringify(source?.oauth?.extraParameters ?? {}, null, 2),
    },
  }
}
export function sourceValues(form: SourceForm): SourcePatch {
  const { oauth, ...values } = form
  return {
    ...values,
    name: form.name.trim(),
    remoteHost: form.remoteHost.trim(),
    remotePort: Number(form.remotePort),
    ...(form.authMechanism === 'xoauth2'
      ? {
          oauth: {
            ...oauth,
            extraParameters: JSON.parse(oauth.extraParameters || '{}') as NonNullable<
              SourcePatch['oauth']
            >['extraParameters'],
            ...(oauth.clientSecret ? { clientSecret: oauth.clientSecret } : {}),
          },
        }
      : {}),
  }
}
export function sourcePatch(form: SourceForm, opened: SyncSource): SourcePatch {
  const base = sourceValues(sourceForm(opened)),
    next = sourceValues(form)
  const patch: SourcePatch = Object.fromEntries(
    Object.entries(next).filter(
      ([key, value]) =>
        key !== 'oauth' && JSON.stringify(value) !== JSON.stringify(base[key as keyof SourcePatch]),
    ),
  )
  if (next.oauth) {
    const oauth = Object.fromEntries(
      Object.entries(next.oauth).filter(([key, value]) =>
        key === 'clientSecret'
          ? !!value
          : JSON.stringify(value) !==
            JSON.stringify(base.oauth?.[key as keyof NonNullable<SourcePatch['oauth']>]),
      ),
    )
    if (Object.keys(oauth).length) patch.oauth = oauth
  }
  return patch
}
export const sourceFieldId = (path: string) => `source-${path.replaceAll('.', '-')}`
