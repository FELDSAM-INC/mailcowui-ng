import { vueTsConfigs, withVueTs } from '@vue/eslint-config-typescript'
import prettier from 'eslint-config-prettier/flat'
import pluginVue from 'eslint-plugin-vue'
import pluginVueA11y from 'eslint-plugin-vuejs-accessibility'

/**
 * Import boundaries (research R3) and the Reka UI parts that inject `<style>` elements, which the
 * strict CSP blocks (research R18).
 */
const generatedApi = {
  group: ['@/api/generated', '@/api/generated/*'],
  message: 'Generated API types are reachable only through `@/api` (constitution I, research R7).',
}
const featureDeepImport = {
  regex: '^@/features/[^/]+/.+',
  message: 'Use the feature through its `index.ts` (`@/features/<name>`), never a deep import.',
}
const sharedUpwards = {
  group: ['@/app', '@/app/*', '@/features', '@/features/*'],
  message: '`src/shared` must not depend on `src/app` or `src/features` (research R3).',
}
const rekaStyleInjectors = {
  name: 'reka-ui',
  importNames: [
    'SelectViewport',
    'ComboboxViewport',
    'AutocompleteViewport',
    'ScrollAreaViewport',
    'Viewport',
    'SplitterResizeHandle',
  ],
  message:
    'This Reka UI part injects a <style> element that the strict CSP blocks (research R18). Use a native element or a plain scrollable list.',
}

function restrictedImports(patterns: object[]): ['error', object] {
  return ['error', { paths: [rekaStyleInjectors], patterns }]
}

const nodeGlobals = Object.fromEntries(
  [
    'process',
    'console',
    'Buffer',
    'URL',
    'URLSearchParams',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'fetch',
    'Response',
    'Request',
    'Headers',
    'AbortController',
    'structuredClone',
    'module',
    'require',
    '__dirname',
    'globalThis',
  ].map((name) => [name, 'readonly' as const]),
)
const browserGlobals = Object.fromEntries(
  ['window', 'document', 'localStorage', 'matchMedia'].map((name) => [name, 'readonly' as const]),
)

export default withVueTs(
  {
    ignores: [
      'src/api/generated/**',
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'blob-report/**',
      '.lighthouseci/**',
      'contract/**',
      'node_modules/**',
      '**/*.d.mts',
    ],
  },
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommendedTypeChecked,
  ...pluginVueA11y.configs['flat/recommended'],
  {
    name: 'mailcowui-ng/vue',
    files: ['**/*.vue'],
    rules: {
      'vue/no-v-html': 'error',
      'vue/no-static-inline-styles': 'error',
      'vue/block-lang': ['error', { script: { lang: 'ts' } }],
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/require-default-prop': 'off',
    },
  },
  {
    // Copied TailAdmin primitives (THIRD_PARTY_NOTICES.md): single-word names are the template's
    // API, and labels and keyboard handling are supplied where a primitive is used, which these
    // rules then check.
    name: 'mailcowui-ng/tailadmin-primitives',
    files: ['src/shared/ui/**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
      'vuejs-accessibility/label-has-for': 'off',
      'vuejs-accessibility/form-control-has-label': 'off',
      'vuejs-accessibility/click-events-have-key-events': 'off',
      'vuejs-accessibility/no-static-element-interactions': 'off',
    },
  },
  {
    name: 'mailcowui-ng/typescript',
    files: ['**/*.ts', '**/*.vue'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
  {
    name: 'mailcowui-ng/boundaries',
    files: ['src/**/*.ts', 'src/**/*.vue', 'tests/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictedImports([generatedApi, featureDeepImport]),
    },
  },
  {
    name: 'mailcowui-ng/boundaries-api',
    files: ['src/api/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictedImports([featureDeepImport]),
    },
  },
  {
    name: 'mailcowui-ng/boundaries-shared',
    files: ['src/shared/**/*.ts', 'src/shared/**/*.vue'],
    rules: {
      'no-restricted-imports': restrictedImports([generatedApi, featureDeepImport, sharedUpwards]),
    },
  },
  {
    name: 'mailcowui-ng/node-scripts',
    files: ['**/*.mjs', '**/*.cjs'],
    languageOptions: { globals: nodeGlobals },
  },
  {
    name: 'mailcowui-ng/browser-scripts',
    files: ['public/**/*.js'],
    languageOptions: { globals: browserGlobals },
  },
  prettier,
)
