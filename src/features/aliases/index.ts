// UI feature 004, aliases (research R3). It also owns what the whole API feature shares: the
// capabilities read, CapabilitiesGate and the permission matrix, which the alias-domains, resources
// and sender-settings areas import from here. Other code reaches it only through this file.
export { aliasesCapabilitiesOptions, useAliasesCapabilities } from './capabilities'
export { default as CapabilitiesGate } from './components/CapabilitiesGate.vue'
export { feature004Permissions, type Feature004Permissions } from './permissions'
export { aliasRoutes } from './routes'
export { aliasDomainPickerSource, domainPickerSource } from './api'
export { default as YesNoMark } from './components/YesNoMark.vue'
