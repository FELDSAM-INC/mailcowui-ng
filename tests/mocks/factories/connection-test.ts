// Connection test results of the routing mock (UI 009 T005, T067): contract-valid results built
// from a script's partial result, with the steps before the failing one filled in. Transcripts stay
// within the contract's limits (at most 501 lines of at most 1,000 characters).
import type { RoutingConnectionTestResult, RoutingConnectionTestStep } from '@/api'

export const TEST_STEPS: readonly RoutingConnectionTestStep[] = [
  'resolve',
  'connect',
  'greeting',
  'tls',
  'login',
  'sender',
  'recipient',
  'message',
]

type Line = RoutingConnectionTestResult['transcript'][number]

/** A plausible dialogue up to a step, with the login redacted. */
export function transcriptUpTo(
  host: string,
  step: RoutingConnectionTestStep,
  options: { tls: boolean; login: boolean; accepted: boolean },
): Line[] {
  const lines: Line[] = []
  const reached = (wanted: RoutingConnectionTestStep) =>
    TEST_STEPS.indexOf(wanted) <= TEST_STEPS.indexOf(step)
  if (!reached('connect')) return lines
  lines.push({ direction: 'info', text: `Connecting to ${host}` })
  if (!reached('greeting')) return lines
  lines.push({ direction: 'server', text: `220 ${host} ESMTP` })
  lines.push({ direction: 'client', text: 'EHLO mail.example.org' })
  lines.push({ direction: 'server', text: `250-${host} Hello` })
  if (options.tls && reached('tls')) {
    lines.push({ direction: 'client', text: 'STARTTLS' })
    lines.push({ direction: 'server', text: '220 2.0.0 Ready to start TLS' })
  }
  if (options.login && reached('login')) {
    lines.push({ direction: 'client', text: 'AUTH PLAIN [redacted]' })
    lines.push({ direction: 'server', text: '235 2.7.0 Authentication successful' })
  }
  if (reached('sender')) {
    lines.push({ direction: 'client', text: 'MAIL FROM:<relay@example.org>' })
    lines.push({ direction: 'server', text: '250 2.1.0 Ok' })
  }
  if (reached('recipient')) {
    lines.push({ direction: 'client', text: 'RCPT TO:<null@hosted.mailcow.de>' })
    lines.push({ direction: 'server', text: '250 2.1.5 Ok' })
  }
  if (reached('message')) {
    lines.push({ direction: 'client', text: 'DATA' })
    lines.push({ direction: 'server', text: '354 End data with <CR><LF>.<CR><LF>' })
    lines.push({ direction: 'client', text: '[message: 312 bytes]' })
    if (options.accepted) lines.push({ direction: 'server', text: '250 2.0.0 Ok: queued' })
  }
  return lines
}

/** A complete result from a script's partial one. */
export function connectionTestResult(
  nextHop: string,
  partial: Partial<RoutingConnectionTestResult>,
  addresses: { sender: string; recipient: string },
  now: number,
): RoutingConnectionTestResult {
  const accepted = partial.accepted ?? true
  const step = partial.step ?? 'message'
  const host = partial.host === undefined ? nextHop.replace(/^\[|\](:\d+)?$/g, '') : partial.host
  const tls = partial.tls ?? true
  const login = partial.login ?? 'notConfigured'
  return {
    accepted,
    step,
    failure: partial.failure ?? null,
    nextHop,
    host,
    port: partial.port ?? 25,
    hostSource: partial.hostSource ?? 'nextHop',
    tls,
    login,
    sender: addresses.sender,
    recipient: addresses.recipient,
    lastReply:
      partial.lastReply === undefined
        ? accepted
          ? { code: 250, text: '2.0.0 Ok: queued' }
          : null
        : partial.lastReply,
    transcript:
      partial.transcript ??
      transcriptUpTo(host ?? nextHop, step, {
        tls,
        login: login === 'succeeded' || login === 'failed',
        accepted,
      }),
    startedAt: partial.startedAt ?? new Date(now).toISOString(),
    durationMs: partial.durationMs ?? 1834,
  }
}
