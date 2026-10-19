// The connection test result in words (research R12, data-model §2 TestSummaryView and
// StepTimeline): the verdict, the step reached or failed with its reason, the server and whether
// an MX lookup found it, TLS, login, the addresses used and the time; and the eight steps, each
// passed, failed, not reached, not offered (TLS) or not configured (login).
import {
  routingConnectionTestResultFailureOneOf0ReasonValues,
  routingConnectionTestStepValues,
  type RoutingConnectionTestResult,
  type RoutingConnectionTestStep,
} from '@/api'

export type StepState = 'passed' | 'failed' | 'notReached' | 'notOffered' | 'notConfigured'

export interface TestSummaryView {
  verdict: 'accepted' | 'notAccepted'
  step: RoutingConnectionTestStep
  /** The translation key of the failure reason, or null when accepted. */
  reasonKey: string | null
  /** An unknown reason value, shown with the generic text. */
  unknownReason: string | null
  lastReply: { code: number; text: string } | null
  server: { host: string; port: number; viaMx: boolean; nextHop: string } | null
  tls: boolean
  login: RoutingConnectionTestResult['login']
  sender: string
  recipient: string
  startedAt: string
  durationSeconds: number
}

const KNOWN_REASONS: readonly string[] = routingConnectionTestResultFailureOneOf0ReasonValues

export function testSummary(result: RoutingConnectionTestResult): TestSummaryView {
  const reason = result.failure?.reason ?? null
  const known = reason !== null && KNOWN_REASONS.includes(reason)
  return {
    verdict: result.accepted ? 'accepted' : 'notAccepted',
    step: result.step,
    reasonKey:
      reason === null
        ? null
        : known
          ? `routing.connectionTest.reason.${reason}`
          : 'routing.connectionTest.reasonUnknown',
    unknownReason: reason !== null && !known ? reason : null,
    lastReply: result.lastReply,
    server:
      result.host === null
        ? null
        : {
            host: result.host,
            port: result.port,
            viaMx: result.hostSource === 'mailExchanger',
            nextHop: result.nextHop,
          },
    tls: result.tls,
    login: result.login,
    sender: result.sender,
    recipient: result.recipient,
    startedAt: result.startedAt,
    durationSeconds: Math.round(result.durationMs / 100) / 10,
  }
}

/** The eight steps in contract order with their state. */
export function stepTimeline(
  result: RoutingConnectionTestResult,
): { step: RoutingConnectionTestStep; state: StepState }[] {
  const reached = routingConnectionTestStepValues.indexOf(result.step)
  return routingConnectionTestStepValues.map((step, index) => {
    let state: StepState
    if (index < reached || (index === reached && result.accepted)) state = 'passed'
    else if (index === reached) state = 'failed'
    else state = 'notReached'
    if (state === 'passed' && step === 'tls' && !result.tls) state = 'notOffered'
    if (state === 'passed' && step === 'login' && result.login === 'notConfigured') {
      state = 'notConfigured'
    }
    return { step, state }
  })
}
