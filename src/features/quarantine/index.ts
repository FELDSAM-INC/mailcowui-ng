// UI feature 006, the quarantine area (research R4): the quarantine list and items, their actions,
// downloads and bulk actions, the notification settings, the quarantine settings and the spam
// filter statistics, and the capabilities and permissions the spam filter and rate limit areas
// use. Other code reaches it only through this file; it imports neither of those areas.
export { quarantineRoutes } from './routes'
export { useQuarantineCapabilities, quarantineCapabilitiesOptions } from './capabilities'
export * from './permissions'
export { default as QuarantineSectionNav } from './components/QuarantineSectionNav.vue'

export { useNotificationEditor } from './composables/useNotificationEditor'
export { useNotificationBulk } from './composables/useNotificationBulk'
export type { NotificationBulkChoice } from './notification-bulk'
export { default as NotificationOptionGroup } from './components/NotificationOptionGroup.vue'
export { default as NotificationBulkAction } from './components/notifications/NotificationBulkAction.vue'
