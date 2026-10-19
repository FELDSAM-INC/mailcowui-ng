// Container handlers (UI 011 T014, T045, T061): the list (`limit`, `offset`, `sort`, `order`, `q`,
// `running`), one container, its resource usage (the first sample of a container without rates;
// `409 container-not-running` while stopped), and start, stop and restart with the documented
// outcomes (`done`, `alreadyInState`), protection, the scenario's per-container outcomes and the
// injections of the scenario.
import type { Container, ContainerAction } from '@/api'

import { containerView, resourceSample, type MockContainer } from '../factories/container'
import type { ContainerOutcome } from '../scenarios/operations/container-actions'
import { collectedAt, hostNow } from '../scenarios/operations/state'
import type { ScenarioState } from '../scenarios/state'
import { csrfProblem, http, problem } from './context'
import { operationGate } from './operations-context'

const notFound = () => problem(404, null)

function findContainer(state: ScenarioState, name: string): MockContainer | undefined {
  return state.operations.dashboard.containers.find((container) => container.name === name)
}

function view(state: ScenarioState, container: MockContainer): Container {
  return containerView(container, collectedAt(state, 'containers'))
}

const SORT_VALUE: Record<string, (container: MockContainer) => string | number> = {
  name: (container) => container.name,
  state: (container) => container.state,
  startedAt: (container) => container.startedAt ?? Number.POSITIVE_INFINITY,
}

/** The scenario's outcome for this container and action, consuming one use. */
function outcomeFor(
  state: ScenarioState,
  name: string,
  action: ContainerAction,
): ContainerOutcome | null {
  const outcome = state.operations.containerActions.outcomes[name]
  if (!outcome || (outcome.action && outcome.action !== action)) return null
  if (outcome.times !== undefined) {
    if (outcome.times <= 0) return null
    outcome.times -= 1
  }
  return outcome
}

/** Carries out an action on the stored container; `alreadyInState` when nothing changes. */
function apply(
  state: ScenarioState,
  container: MockContainer,
  action: ContainerAction,
): 'done' | 'alreadyInState' {
  const now = hostNow(state)
  if (action === 'stop') {
    if (!container.running) return 'alreadyInState'
    Object.assign(container, { running: false, state: 'exited' })
    return 'done'
  }
  if (action === 'start' && container.running) return 'alreadyInState'
  Object.assign(container, { running: true, state: 'running', startedAt: now })
  delete state.operations.dashboard.samples[container.name]
  return 'done'
}

function actionHandler(action: ContainerAction, path: `/containers/{containerName}/${string}`) {
  const operationId = `${action}Container`
  return http.post(
    path as '/containers/{containerName}/restart',
    async ({ request, params, response }) => {
      const gate = await operationGate(operationId)
      if (gate.stop) return response.untyped(gate.stop)
      const state = gate.state
      const csrf = csrfProblem(state, request)
      if (csrf) return response.untyped(csrf)
      const name = String(params.containerName)
      const outcome = outcomeFor(state, name, action)
      if (outcome?.delayMs) await new Promise((resolve) => setTimeout(resolve, outcome.delayMs))
      if (outcome?.removed) {
        const index = state.operations.dashboard.containers.findIndex((item) => item.name === name)
        if (index >= 0) state.operations.dashboard.containers.splice(index, 1)
      }
      const container = findContainer(state, name)
      if (!container) return response.untyped(notFound())
      const isApi = container.role === 'api'
      if ((action === 'stop' && container.protected) || (action !== 'start' && isApi)) {
        return response.untyped(problem(409, 'container-protected', { container: name }))
      }
      const audit = outcome?.auditRecorded === false ? { 'Audit-Recorded': 'false' } : undefined
      if (outcome?.problem) {
        if (outcome.carriedOut) apply(state, container, action)
        const extra: Record<string, unknown> = { ...outcome.problem.extensions }
        if (outcome.problem.problemType.startsWith('container-')) extra.container = name
        return response.untyped(
          problem(outcome.problem.status, outcome.problem.problemType, extra, audit ?? {}),
        )
      }
      const result = apply(state, container, action)
      return gate.finish(
        response(200).json(
          { data: { action, outcome: result, container: view(state, container) } },
          audit ? { headers: audit } : undefined,
        ),
      )
    },
  )
}

export const containerHandlers = [
  http.get('/containers', async ({ query, response }) => {
    const gate = await operationGate('listContainers')
    if (gate.stop) return response.untyped(gate.stop)
    const state = gate.state
    const limit = Number(query.get('limit') ?? 25)
    const offset = Number(query.get('offset') ?? 0)
    const sort = query.get('sort') ?? 'name'
    const order = query.get('order') ?? 'asc'
    const q = (query.get('q') ?? '').toLowerCase()
    const running = query.get('running')
    let items = state.operations.dashboard.containers.filter(
      (container) =>
        (!q || container.name.includes(q) || container.image.toLowerCase().includes(q)) &&
        (running === null || String(container.running) === running),
    )
    const value = SORT_VALUE[sort] ?? SORT_VALUE.name!
    items = [...items].sort((a, b) => {
      const [x, y] = [value(a), value(b)]
      const compared = x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name)
      return order === 'desc' ? -compared : compared
    })
    return gate.finish(
      response(200).json({
        data: items.slice(offset, offset + limit).map((container) => view(state, container)),
        meta: { total: items.length, limit, offset },
      }),
    )
  }),

  http.get('/containers/{containerName}', async ({ params, response }) => {
    const gate = await operationGate('getContainer')
    if (gate.stop) return response.untyped(gate.stop)
    const container = findContainer(gate.state, String(params.containerName))
    if (!container) return response.untyped(notFound())
    return gate.finish(response(200).json({ data: view(gate.state, container) }))
  }),

  http.get('/containers/{containerName}/resource-usage', async ({ params, response }) => {
    const gate = await operationGate('getContainerResourceUsage')
    if (gate.stop) return response.untyped(gate.stop)
    const state = gate.state
    const name = String(params.containerName)
    const container = findContainer(state, name)
    if (!container) return response.untyped(notFound())
    if (!container.running) {
      return response.untyped(problem(409, 'container-not-running', { container: name }))
    }
    const samples = state.operations.dashboard.samples
    const previous = samples[name] ?? { sequence: 0, last: null }
    const now = Date.parse(collectedAt(state, 'resourceUsage'))
    const sample = resourceSample(container, previous.sequence, now, previous.last)
    samples[name] = { sequence: previous.sequence + 1, last: now }
    return gate.finish(response(200).json({ data: sample }))
  }),

  actionHandler('start', '/containers/{containerName}/start'),
  actionHandler('stop', '/containers/{containerName}/stop'),
  actionHandler('restart', '/containers/{containerName}/restart'),
]
