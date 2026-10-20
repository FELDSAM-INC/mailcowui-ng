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
    // Constitution VII: performance >= 0.8, accessibility >= 0.9, initial payload <= 200 KB.
    // Owner decision (2026-10-20): shell-page script transfer may reach 210 KiB, including lazy
    // route scripts and transfer overhead. `npm run budget:check` still caps the entry and its
    // static imports at 200 KiB gzipped. Feature pages retain their separate chunk budgets.
    assert: {
      assertMatrix: [
        {
          matchingUrlPattern: '/ng/(sign-in)?$',
          assertions: {
            'categories:performance': ['error', { minScore: 0.8 }],
            'categories:accessibility': ['error', { minScore: 0.9 }],
            'resource-summary:script:size': ['error', { maxNumericValue: 215040 }],
          },
        },
        {
          matchingUrlPattern: '/ng/(domains|aliases|mailboxes)$',
          assertions: {
            'categories:performance': ['error', { minScore: 0.8 }],
            'categories:accessibility': ['error', { minScore: 0.9 }],
          },
        },
        {
          // UI 010 (T109): the DKIM keys, with their route loaded lazily.
          matchingUrlPattern: '/ng/dns/dkim-keys',
          assertions: {
            'categories:performance': ['error', { minScore: 0.8 }],
            'categories:accessibility': ['error', { minScore: 0.9 }],
          },
        },
        {
          // UI 009 T116.
          matchingUrlPattern: '/ng/routing/relayhosts',
          assertions: {
            'categories:performance': ['error', { minScore: 0.8 }],
            'categories:accessibility': ['error', { minScore: 0.9 }],
          },
        },
        {
          matchingUrlPattern: '/ng/quarantine$',
          assertions: {
            'categories:performance': ['error', { minScore: 0.8 }],
            'categories:accessibility': ['error', { minScore: 0.9 }],
          },
        },
        {
          matchingUrlPattern: '/ng/account$',
          assertions: {
            'categories:performance': ['error', { minScore: 0.8 }],
            'categories:accessibility': ['error', { minScore: 0.9 }],
          },
        },
        // UI 011 (research R22): the dashboard, whose charts are a lazy chunk of their own.
        {
          matchingUrlPattern: '/ng/operations/dashboard',
          assertions: {
            'categories:performance': ['error', { minScore: 0.8 }],
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
