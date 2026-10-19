// The transcript of a connection test (research R13): a marker per direction (`C:` for lines the
// test sent, `S:` for lines the server sent, `*` for notes of the test), and the plain text of the
// copy action, one line per entry with its marker.
import type { RoutingConnectionTestResult } from '@/api'

type Line = RoutingConnectionTestResult['transcript'][number]

export const MARKERS: Record<Line['direction'], string> = { client: 'C:', server: 'S:', info: '*' }

export function toPlainText(lines: readonly Line[]): string {
  return lines.map((line) => `${MARKERS[line.direction]} ${line.text}`).join('\n')
}
