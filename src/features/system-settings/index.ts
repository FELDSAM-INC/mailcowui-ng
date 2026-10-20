// Public entry of UI013. Route registration may import routes.ts directly to keep pages lazy.
export { systemSettingsRoutes } from './routes'

import { defineAsyncComponent } from 'vue'
import { loadFeatureMessages } from '@/i18n'
export const QuotaCopiesSection = defineAsyncComponent(() =>
  Promise.all([
    import('./components/notifications/QuotaCopiesSection.vue'),
    loadFeatureMessages('system-settings'),
  ]).then(([component]) => component),
)
export const PresetPicker = defineAsyncComponent(() =>
  Promise.all([
    import('./components/spam/PresetPicker.vue'),
    loadFeatureMessages('system-settings'),
  ]).then(([component]) => component.default),
)
