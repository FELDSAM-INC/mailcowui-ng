// The app's entry (research R11): the capture of a single sign-on return (UI 012), plugins, the
// session wiring, the bootstrap before the first navigation resolves, then mount.
import './styles/main.css'

import { captureSingleSignOnReturn } from '@/features/auth'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import { queryClient } from '@/api'

import App from './App.vue'
import { bootstrapStatus, runBootstrap, whenBootstrapped } from './app/bootstrap'
import { createAppRouter } from './app/router'
import { installFocusManagement } from './app/router/focus'
import { installGuards } from './app/router/guards'
import { installSession } from './app/session'
import { i18n } from './i18n'
import { createAppChannel } from './shared/platform/broadcast'

async function start() {
  const app = createApp(App)
  app.use(createPinia())
  app.use(VueQueryPlugin, { queryClient })
  app.use(i18n)

  const router = createAppRouter()
  installGuards(router, { queryClient, ready: whenBootstrapped })
  installFocusManagement(router)
  installSession({ queryClient, router, channel: createAppChannel() })

  await runBootstrap({ queryClient })
  app.use(router)
  // After a failed bootstrap the first navigation waits for the retry (ServiceUnavailablePage).
  if (bootstrapStatus.value === 'ready') await router.isReady()
  app.mount('#app')
}

// UI 012 (research R5): the single sign-on return's code and state leave the address before the
// router and the bootstrap send any request.
captureSingleSignOnReturn()
void start()
