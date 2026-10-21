import type { InjectionKey } from 'vue'

/** Wait for the menu to close before a dialog captures its return-focus target. */
export const rowActionTrigger: InjectionKey<() => Promise<HTMLElement | null>> =
  Symbol('rowActionTrigger')
