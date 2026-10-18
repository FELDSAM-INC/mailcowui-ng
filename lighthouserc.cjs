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
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'resource-summary:script:size': ['error', { maxNumericValue: 204800 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci/reports',
    },
  },
}
