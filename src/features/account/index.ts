// UI feature 005, account self-service. Other code reaches it only through this file; it exports
// routes and light modules only (research R25).
export { accountRoutes } from './routes'
export { mailboxSelfServiceRoutes } from './mailbox-routes'
export { useSelfServiceCapabilities } from './api/capabilities'
// The pending-actions screen's forced password change (UI 001's auth feature).
export { changeOwnPassword, useOwnPasswordPolicy } from './api/password'
