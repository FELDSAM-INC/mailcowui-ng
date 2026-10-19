// The remaining time of an active ban, as legacy formats it (`%02dh %02dm %02ds`,
// `inc/functions.fail2ban.inc.php`); the words around the numbers are a new string.

export function remainingParts(seconds: number): {
  hours: string
  minutes: string
  seconds: string
} {
  const total = Math.max(0, Math.floor(seconds))
  const two = (value: number) => String(value).padStart(2, '0')
  return {
    hours: two(Math.floor(total / 3600)),
    minutes: two(Math.floor((total % 3600) / 60)),
    seconds: two(total % 60),
  }
}
