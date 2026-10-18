// Scenarios of US6 (T116): languages offered by the server, profile preferences and failed saves.
import type { ScenarioDefinition } from './index'

const EN = { code: 'en-gb', name: 'English' }
const CS = { code: 'cs-cz', name: 'Čeština (Czech)' }
const SK = { code: 'sk-sk', name: 'Slovenčina (Slovak)' }
const DE = { code: 'de-de', name: 'Deutsch (German)' }

export const preferenceScenarios: Record<string, ScenarioDefinition> = {
  'languages-none-translated': {
    description:
      'The server enables only German, which the app does not translate (admin signs in).',
    overrides: { publicConfig: { languages: [DE], defaultLanguage: 'de-de' } },
  },
  'languages-single': {
    description: 'The server enables only English.',
    overrides: { publicConfig: { languages: [EN], defaultLanguage: 'en-gb' } },
  },
  'default-language-sk': {
    description: 'The server default language is Slovak.',
    overrides: { publicConfig: { languages: [EN, CS, SK, DE], defaultLanguage: 'sk-sk' } },
  },
  'profile-cs-dark': {
    description: "admin's profile is Czech and dark; nobody is signed in.",
    overrides: {
      accounts: { admin: { preferences: { language: 'cs-cz', theme: 'dark', etag: '"pref-cs"' } } },
    },
  },
  'profile-language-disabled': {
    description:
      "admin's profile language (Slovak) is no longer enabled; the server default is Czech.",
    overrides: {
      publicConfig: { languages: [EN, CS], defaultLanguage: 'cs-cz' },
      accounts: {
        admin: { preferences: { language: 'sk-sk', theme: 'system', etag: '"pref-sk"' } },
      },
    },
  },
  'preferences-save-fails': {
    description: 'admin is signed in; saving preferences fails with a server error.',
    overrides: { signedInAs: 'admin', failures: { updatePreferences: { status: 500 } } },
  },
}
