// The public surface of UI 009 (research R2, R9): its routes, and the relayhost choice that UI 002's
// domain page and UI 003's mailbox page show in their legacy positions.
import { defineAsyncComponent } from 'vue'

export { routingRoutes } from './routes'
export {
  relayhostLabel,
  useRelayhostAssignment,
  type RelayhostAssignmentState,
} from './composables/useRelayhostAssignment'

/** The relayhost choice of UI 002's Domain section and UI 003's Mailbox section, loaded on use. */
export const RelayhostAssignmentField = defineAsyncComponent(
  () => import('./components/sections/RelayhostAssignmentField.vue'),
)
