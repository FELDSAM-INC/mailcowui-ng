// Containers of a mailcow installation for the operations mock (UI 011 T044): the service names,
// images, roles and protection of mailcow-dockerized, this API's own container (`role: api`) and
// the web app's (`role: webApp`), with the available actions derived as the contract describes
// (`start` when not running, `stop` when running and not protected, `restart` unless this is the
// API's own container), and resource samples whose rates are `null` on the first sample.
import type { Container, ContainerResourceUsage, ContainerRole, ContainerState } from '@/api'

export interface MockContainer {
  name: string
  image: string
  state: ContainerState
  running: boolean
  /** Epoch ms of the last start; null when never started. */
  startedAt: number | null
  health: Container['health']
  protected: boolean
  role: ContainerRole
  /** Bytes; the resource figures of the container. */
  memoryUsed: number
  memoryLimit: number
}

const GiB = 1024 ** 3
const MiB = 1024 ** 2

const SERVICES: [string, string, ContainerRole, boolean][] = [
  ['acme-mailcow', 'ghcr.io/mailcow/acme:1.94', 'certificates', false],
  ['api-mailcow', 'ghcr.io/feldsam/mailcow-rest-v2:0.1.0', 'api', true],
  ['clamd-mailcow', 'ghcr.io/mailcow/clamd:1.71', 'antivirus', false],
  ['dockerapi-mailcow', 'ghcr.io/mailcow/dockerapi:2.11', 'containerService', true],
  ['dovecot-mailcow', 'ghcr.io/mailcow/dovecot:2.35', 'imap', false],
  ['memcached-mailcow', 'memcached:alpine', 'cache', false],
  ['mysql-mailcow', 'mariadb:10.11', 'database', true],
  ['netfilter-mailcow', 'ghcr.io/mailcow/netfilter:1.63', 'banService', false],
  ['nginx-mailcow', 'ghcr.io/mailcow/nginx:1.03', 'proxy', true],
  ['ng-mailcow', 'ghcr.io/feldsam/mailcowui-ng:0.1.0', 'webApp', false],
  ['ofelia-mailcow', 'mcuadros/ofelia:latest', 'scheduler', false],
  ['olefy-mailcow', 'ghcr.io/mailcow/olefy:1.15', 'macroScanner', false],
  ['php-fpm-mailcow', 'ghcr.io/mailcow/phpfpm:1.93', 'legacyWebApp', false],
  ['postfix-mailcow', 'ghcr.io/mailcow/postfix:1.80', 'mailTransfer', false],
  ['postfix-tlspol-mailcow', 'ghcr.io/mailcow/postfix-tlspol:1.8', 'tlsPolicy', false],
  ['redis-mailcow', 'redis:7.4.6-alpine', 'keyValueStore', true],
  ['rspamd-mailcow', 'ghcr.io/mailcow/rspamd:2.2', 'spamFilter', false],
  ['sogo-mailcow', 'ghcr.io/mailcow/sogo:1.133', 'webmail', false],
  ['unbound-mailcow', 'ghcr.io/mailcow/unbound:1.24', 'dnsResolver', false],
  ['watchdog-mailcow', 'ghcr.io/mailcow/watchdog:2.08', 'healthMonitor', false],
]

/** The installation's containers, all running and healthy, started an hour before `now`. */
export function mailcowContainers(now: number): MockContainer[] {
  return SERVICES.map(([name, image, role, isProtected], index) => ({
    name,
    image,
    state: 'running',
    running: true,
    startedAt: now - 3_600_000 - index * 60_000,
    health: role === 'antivirus' || role === 'database' ? 'healthy' : null,
    protected: isProtected,
    role,
    memoryUsed: (64 + index * 16) * MiB,
    memoryLimit: 2 * GiB,
  }))
}

export function availableActions(container: MockContainer): Container['availableActions'] {
  const actions: Container['availableActions'] = []
  if (!container.running) actions.push('start')
  if (container.running && !container.protected) actions.push('stop')
  if (container.role !== 'api') actions.push('restart')
  return actions
}

export function containerView(container: MockContainer, collectedAt: string): Container {
  return {
    name: container.name,
    image: container.image,
    state: container.state,
    running: container.running,
    startedAt: container.startedAt === null ? null : new Date(container.startedAt).toISOString(),
    health: container.running ? container.health : null,
    protected: container.protected,
    role: container.role,
    availableActions: availableActions(container),
    collectedAt,
  }
}

/**
 * A resource sample: the counters grow with every sample; the rates are `null` on the first one
 * (`previous` null), as the API needs two samples for a rate.
 */
export function resourceSample(
  container: MockContainer,
  sequence: number,
  sampledAt: number,
  previousAt: number | null,
): ContainerResourceUsage {
  const read = 1_000_000 + sequence * 524_288
  const written = 2_000_000 + sequence * 262_144
  const received = 3_000_000 + sequence * 131_072
  const sent = 4_000_000 + sequence * 65_536
  const seconds = previousAt === null ? 0 : Math.max(1, (sampledAt - previousAt) / 1000)
  const rate = (step: number) => (previousAt === null ? null : step / seconds)
  return {
    containerName: container.name,
    sampledAt: new Date(sampledAt).toISOString(),
    previousSampledAt: previousAt === null ? null : new Date(previousAt).toISOString(),
    cpuPercent: previousAt === null ? null : 3 + (sequence % 5),
    memory: { usedBytes: container.memoryUsed, limitBytes: container.memoryLimit },
    disk: {
      readBytes: read,
      writtenBytes: written,
      readBytesPerSecond: rate(524_288 + (sequence % 3) * 1024),
      writeBytesPerSecond: rate(262_144),
    },
    network: {
      receivedBytes: received,
      sentBytes: sent,
      receiveBytesPerSecond: rate(131_072 + (sequence % 4) * 2048),
      sendBytesPerSecond: rate(65_536),
    },
  }
}
