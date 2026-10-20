// One in-memory outcome for the destination screen; no form values or secrets.
let next: { username: string; message: string } | null = null
export function setAccountFlash(username: string, message: string): void {
  next = { username, message }
}
export function takeAccountFlash(username: string): string | null {
  const value = next?.username === username ? next.message : null
  next = null
  return value
}
