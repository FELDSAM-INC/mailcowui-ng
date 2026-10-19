// Moved to tests/support/totp.ts (UI 005 T008), which the mock and the end-to-end tests share. This
// re-export keeps the smoke specs of features developed in parallel working until they import the
// new path.
export * from '../../support/totp'
