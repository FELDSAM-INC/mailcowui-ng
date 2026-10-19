// Scales of the live charts (research R7): percentages on a fixed 0–100 scale; rates up to a
// "nice" binary step above the largest value; samples placed left to right in the view box.
export type ChartKind = 'percent' | 'rate'

export const VIEW_WIDTH = 300
export const VIEW_HEIGHT = 100

/** The smallest power of two times 1,024 (at least 1 KiB) that is not below the value. */
export function niceBinaryMax(value: number): number {
  let max = 1024
  while (max < value) max *= 2
  return max
}

export function scaleMax(kind: ChartKind, values: readonly (number | null)[]): number {
  if (kind === 'percent') return 100
  const largest = Math.max(0, ...values.filter((value): value is number => value !== null))
  return niceBinaryMax(largest)
}

/**
 * The points of one series: sample `i` of `slots` at x = i / (slots − 1) of the width, the value
 * from the bottom (0) to the top (`max`); null values are left out.
 */
export function points(
  values: readonly (number | null)[],
  max: number,
  slots: number,
): [number, number][] {
  const step = slots > 1 ? VIEW_WIDTH / (slots - 1) : 0
  const result: [number, number][] = []
  values.forEach((value, index) => {
    if (value === null) return
    const ratio = Math.min(1, Math.max(0, value / max))
    result.push([index * step, VIEW_HEIGHT - ratio * VIEW_HEIGHT])
  })
  return result
}

/** One sample of a live series as the charts read it (read-only). */
export interface ChartSample {
  readonly t: string
  readonly values: readonly (number | null)[]
}
