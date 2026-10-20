import { defineAsyncComponent } from 'vue'

export const ActiveScriptPanel = defineAsyncComponent(
  () => import('./components/ActiveScriptPanel.vue'),
)
export { filterPages } from './routes'
