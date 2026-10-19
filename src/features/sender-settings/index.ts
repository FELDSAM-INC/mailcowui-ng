// UI feature 004, the sender settings of a mailbox (research R3): "Allow to send as" and "External
// sender addresses" in UI 003's "Mailbox" section, at their legacy positions. Other code reaches
// it only through this file.
export { default as ExternalSenderField } from './components/ExternalSenderField.vue'
export { default as SenderAclField } from './components/SenderAclField.vue'
export { useSenderSettings, type SenderSettingsState } from './useSenderSettings'
