// The sign-in feature (US1, US2, US5; UI 012 single sign-on): its routes, and the capture of the
// single sign-on return that `src/main.ts` runs first. Other code reaches the feature only here.
export { authRoutes } from './routes'
export { captureSingleSignOnReturn } from './sso/capture'
export { captureResetToken } from './reset-token'
