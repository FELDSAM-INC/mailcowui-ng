// Ban service handlers (UI 011 T014, T100): settings, rules, bans and rotation, filled by US5.
import type { RequestHandler } from 'msw'

export const fail2banHandlers: RequestHandler[] = []
