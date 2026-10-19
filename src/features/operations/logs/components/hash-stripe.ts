// The rate-limited log's colour stripe (plan decision 2): legacy gives every rate limit hash its
// own colour (`admin.hash_remove_info` says so). The stripe is decorative; the hash stays a column.
const STRIPES = [
  'border-s-red-500',
  'border-s-orange-500',
  'border-s-amber-500',
  'border-s-lime-500',
  'border-s-emerald-500',
  'border-s-cyan-500',
  'border-s-blue-500',
  'border-s-violet-500',
  'border-s-fuchsia-500',
  'border-s-rose-500',
] as const

/** The stripe class of a hash (legacy's `hashCode`), gray without a hash. */
export function stripeClass(hash: string | null): string {
  if (hash === null) return 'border-s-gray-400'
  let code = 0
  for (let index = 0; index < hash.length; index += 1) {
    code = (hash.charCodeAt(index) + ((code << 5) - code)) | 0
  }
  return STRIPES[Math.abs(code) % STRIPES.length]!
}
