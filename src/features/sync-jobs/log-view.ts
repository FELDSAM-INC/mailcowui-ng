// The run log's view (UI 008 research R17, data-model §2): the text in chunks of 500 lines, so the
// browser lays out only the visible ones (`content-visibility`), and the states of an empty log.
// Chunking keeps every character: the chunks join back to the input, and Copy uses the original.
import type { SyncJobRunStatus } from '@/api'

export const LOG_CHUNK_LINES = 500

export function chunkLog(text: string, lines = LOG_CHUNK_LINES): string[] {
  const chunks: string[] = []
  let start = 0
  let count = 0
  for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) {
    count += 1
    if (count === lines) {
      chunks.push(text.slice(start, index + 1))
      start = index + 1
      count = 0
    }
  }
  if (start < text.length) chunks.push(text.slice(start))
  return chunks
}

/** An empty log: the job never ran ("No log yet"), or a run produced no output. */
export function emptyLogState(run: SyncJobRunStatus): 'never' | 'noOutput' {
  return run.lastRunAt === null && !run.logAvailable ? 'never' : 'noOutput'
}
