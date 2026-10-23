// What the whole of UI feature 004 shares (research R3): the capabilities read, CapabilitiesGate,
// the permission matrix, the domain picker sources, the yes/no mark and the mass action building
// blocks. The aliases, alias-domains, resources and sender-settings areas import them from here,
// so that the routes the shell loads (`@/features/aliases`, …) carry none of it.
export { aliasesCapabilitiesOptions, useAliasesCapabilities } from './capabilities'
export { default as CapabilitiesGate } from './components/CapabilitiesGate.vue'
export { feature004Permissions, type Feature004Permissions } from './permissions'
export { aliasDomainPickerSource, domainPickerSource } from './pickers'
export { default as YesNoMark } from '@/shared/components/YesNoMark.vue'
export { retainedIds, toTargets, unquote, type BulkActionConfig, type BulkConfirm } from './bulk'
export { useBulkRun } from './composables/useBulkRun'
export { default as BulkConfirmContent } from './components/BulkConfirmContent.vue'
