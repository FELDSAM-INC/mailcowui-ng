// The quarantine API calls and their cache rules (UI 006 data-model §3, research R25). The
// quarantine area never imports the spam filter or rate limit areas (research R4), which is why the
// statistics query lives here although its key root is `spam-policy`.
export { fetchQuarantineCapabilities, quarantineCapabilitiesOptions } from './capabilities'
