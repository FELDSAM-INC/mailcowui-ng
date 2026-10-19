// Lighthouse CI (research R26). `npm run lhci` (scripts/run-lhci.mjs) starts the mock server and
// `vite preview` once per default scenario and collects one URL each; this file holds the shared
// collection settings and the assertions.
module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      // Lighthouse's default form factor is mobile (Moto G Power emulation, throttled 4G).
      settings: {
        formFactor: 'mobile',
        chromeFlags: '--no-sandbox --headless=new',
      },
    },
    // Constitution VII: scores of at least 0.9 everywhere, and an initial payload of at most 200 KB.
    // On the shell's own pages every script is initial, so their total is held to the budget; a
    // feature page adds its lazily loaded route on top (UI 002 T104), and `npm run budget:check`
    // holds the initial payload of the build.
    assert: {
      assertMatrix: [
        {
          matchingUrlPattern: '/ng/(sign-in)?$',
          assertions: {
            'categories:performance': ['error', { minScore: 0.9 }],
            'categories:accessibility': ['error', { minScore: 0.9 }],
            'resource-summary:script:size': ['error', { maxNumericValue: 204800 }],
          },
        },
        {
          matchingUrlPattern: '/ng/(domains|aliases|mailboxes)$',
          assertions: {
            'categories:performance': ['error', { minScore: 0.9 }],
            'categories:accessibility': ['error', { minScore: 0.9 }],
          },
        },
        {
          // UI 010 (T109): the DKIM keys, with their route loaded lazily.
          matchingUrlPattern: '/ng/dns/dkim-keys',
          assertions: {
            'categories:performance': ['error', { minScore: 0.9 }],
            'categories:accessibility': ['error', { minScore: 0.9 }],
          },
        },
        {
          // UI 009 T116.
          matchingUrlPattern: '/ng/routing/relayhosts',
          assertions: {
            'categories:performance': ['error', { minScore: 0.9 }],
            'categories:accessibility': ['error', { minScore: 0.9 }],
          },
        },
      ],
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci/reports',
    },
  },
}
