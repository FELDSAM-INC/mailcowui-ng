// Pre-hashed passwords (G31): a value that starts with `{<scheme>}`, one of the schemes the
// capabilities list, in any letter case, is stored as given without the policy check.
export function isPreHashed(value: string, schemes: readonly string[]): boolean {
  const match = /^\{([^}]+)\}/.exec(value)
  if (!match) return false
  const scheme = match[1]!.toUpperCase()
  return schemes.some((item) => item.toUpperCase() === scheme)
}
