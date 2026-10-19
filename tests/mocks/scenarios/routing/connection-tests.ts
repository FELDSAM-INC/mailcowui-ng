// Connection test scripts (UI 009 T067): relayhost 1 accepted with TLS and login, relayhost 3
// inactive and accepted, one transport per failed step, one via an MX lookup, one with markup in
// the transcript, one with the longest transcript and one that never answers.
import type { RoutingConnectionTestResult, RoutingConnectionTestStep } from '@/api'

import { transcriptUpTo } from '../../factories/connection-test'
import { mockTransport } from '../../factories/transport'
import type { ScenarioDefinition } from '../index'
import type { ScenarioState } from '../state'
import { routingSetup } from './base'
import { seedRelayhosts } from './relayhosts'
import type { MockTestScript } from './state'

type Failure = NonNullable<RoutingConnectionTestResult['failure']>

const FAILURES: readonly {
  id: number
  step: RoutingConnectionTestStep
  reason: Failure['reason']
  reply?: { code: number; text: string }
}[] = [
  { id: 11, step: 'resolve', reason: 'nameNotResolved' },
  { id: 12, step: 'connect', reason: 'connectionRefused' },
  { id: 13, step: 'greeting', reason: 'timeout' },
  { id: 14, step: 'tls', reason: 'tlsFailed' },
  {
    id: 15,
    step: 'login',
    reason: 'rejected',
    reply: { code: 535, text: '5.7.8 Authentication credentials invalid' },
  },
  { id: 16, step: 'sender', reason: 'rejected', reply: { code: 553, text: '5.7.1 Sender denied' } },
  {
    id: 17,
    step: 'recipient',
    reason: 'rejected',
    reply: { code: 550, text: '5.1.1 Recipient unknown' },
  },
  { id: 18, step: 'message', reason: 'rejected', reply: { code: 554, text: '5.7.1 Spam' } },
]

export const TEST_TRANSPORTS = {
  mx: 19,
  markup: 20,
  long: 21,
  never: 22,
  ...Object.fromEntries(FAILURES.map((item) => [item.step, item.id])),
} as Record<RoutingConnectionTestStep | 'mx' | 'markup' | 'long' | 'never', number>

function failureScript(item: (typeof FAILURES)[number]): MockTestScript {
  const host = `${item.step}.partner.example`
  const beforeLogin = ['resolve', 'connect', 'greeting', 'tls'].includes(item.step)
  return {
    result: {
      accepted: false,
      step: item.step,
      failure: { reason: item.reason, message: `The test failed at ${item.step}.` },
      host: item.step === 'resolve' ? null : host,
      port: 25,
      tls: !['resolve', 'connect', 'greeting', 'tls'].includes(item.step),
      login: item.step === 'login' ? 'failed' : beforeLogin ? 'notReached' : 'succeeded',
      lastReply: item.reply ?? null,
      transcript: [
        ...transcriptUpTo(host, item.step, {
          tls: item.step !== 'tls',
          login: item.step === 'login',
          accepted: false,
        }),
        ...(item.reply
          ? [{ direction: 'server' as const, text: `${item.reply.code} ${item.reply.text}` }]
          : []),
      ],
    },
  }
}

export function seedConnectionTests(state: ScenarioState): void {
  seedRelayhosts(state)
  state.routing.tests['relayhost:1'] = {
    result: { accepted: true, tls: true, login: 'succeeded', port: 587, host: 'smtp.example.net' },
  }
  state.routing.tests['relayhost:3'] = { result: { accepted: true, tls: false } }
  for (const item of FAILURES) {
    state.routing.transports.push(
      mockTransport({
        id: item.id,
        destination: `${item.step}.example`,
        nextHop: `[${item.step}.partner.example]:25`,
        active: true,
      }),
    )
    state.routing.tests[`transport:${item.id}`] = failureScript(item)
  }
  state.routing.transports.push(
    mockTransport({ id: 19, destination: 'mx.example', nextHop: 'partner.net', active: true }),
    mockTransport({ id: 20, destination: 'markup.example', nextHop: '[markup.example]:25' }),
    mockTransport({ id: 21, destination: 'long.example', nextHop: '[long.example]:25' }),
    mockTransport({ id: 22, destination: 'never.example', nextHop: '[never.example]:25' }),
  )
  state.routing.tests['transport:19'] = {
    result: { accepted: true, host: 'mx1.partner.net', hostSource: 'mailExchanger', port: 25 },
  }
  state.routing.tests['transport:20'] = {
    result: {
      accepted: true,
      transcript: [
        { direction: 'server', text: '220 markup.example ESMTP <b>not markup</b>' },
        { direction: 'client', text: 'EHLO mail.example.org' },
        { direction: 'server', text: '250 2.0.0 Ok: queued' },
      ],
    },
  }
  state.routing.tests['transport:21'] = {
    result: {
      accepted: true,
      transcript: Array.from({ length: 501 }, (_, index) => ({
        direction: index % 2 === 0 ? ('server' as const) : ('client' as const),
        text: `${index} ${'x'.repeat(995)}`.slice(0, 1000),
      })),
    },
  }
  state.routing.tests['transport:22'] = { never: true }
}

export const connectionTestScenarios: Record<string, ScenarioDefinition> = {
  'routing-tests': {
    description:
      'Relayhosts and transports with a scripted connection test result each (UI 009 US4).',
    overrides: { signedInAs: 'admin' },
    setup: routingSetup(seedConnectionTests),
  },
}
