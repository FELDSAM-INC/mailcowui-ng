import { api, requireData, type ImpersonationStartRequest, type ImpersonationStarted } from '@/api'

/** The renewed anti-forgery token is never put in either query cache. */
export async function startImpersonation(
  body: ImpersonationStartRequest,
): Promise<ImpersonationStarted> {
  return requireData(await api.POST('/session/impersonation', { body })).data
}

export async function endImpersonation(): Promise<void> {
  await api.DELETE('/session/impersonation')
}
