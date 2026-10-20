import type { FieldViolation } from '@/api'

export const normaliseUsername = (value: string): string => value.trim().toLowerCase()

/** Match the API's accountUsername rule; password policy remains the server's decision. */
export function validateUsername(
  value: string,
  max = 255,
): Pick<FieldViolation, 'code' | 'params'> | null {
  const username = normaliseUsername(value)
  if (!username) return { code: 'required', params: {} }
  if (username.length > max) return { code: 'tooLong', params: { max } }
  if (username === 'api') return { code: 'reserved', params: {} }
  if (!/^[a-z0-9._-]+$/.test(username) || !/[a-z0-9]/.test(username))
    return { code: 'invalidFormat', params: { format: 'accountUsername' } }
  return null
}
