// Mail queue handlers (UI 011 T014, T086): list, content, bulk actions, flush and purge, filled by US4.
import type { RequestHandler } from 'msw'

export const mailQueueHandlers: RequestHandler[] = []
