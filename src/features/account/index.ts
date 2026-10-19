// UI feature 005, account self-service. Other code reaches it only through this file; it exports
// routes and light modules only (research R25).
export { accountRoutes } from './routes'
export { mailboxSelfServiceRoutes } from './mailbox-routes'
export { useSelfServiceCapabilities } from './api/capabilities'
