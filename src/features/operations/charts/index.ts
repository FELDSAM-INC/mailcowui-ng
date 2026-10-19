// The live chart, loaded as its own chunk when a screen with charts shows one (constitution:
// charts are lazy-loaded on their route; research R7, R22). Screens import this, never the
// component itself, so the figures are shown without waiting for the chart.
import { defineAsyncComponent } from 'vue'

export const LiveLineChart = defineAsyncComponent(() => import('./LiveLineChart.vue'))
