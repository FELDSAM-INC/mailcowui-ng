<script setup lang="ts">
// The MTA-STS form (legacy `templates/edit/domain.twig` #dmtasts, settled deviations 1–5): the
// version select with its one option STSv1, the mode select with the raw values in legacy order and
// legacy's explanation shown whole, the max age in seconds, the comma-separated MX servers with
// legacy's notice, and "Active"; every help text of legacy's tooltips is shown below its label. The
// used length of the MX servers is shown from 90 % of the limit (FR-048), and next to the set-up
// form the certificate notice of FR-051.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DnsCapabilities } from '@/api'
import { lt } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import type { AppLocale } from '@/i18n/locales'
import LegacyText from '@/shared/components/LegacyText.vue'
import { InfoIcon } from '@/shared/icons'

import FieldErrors from './MtaStsFieldErrors.vue'

import { joinedLength, nearLimit, parseMxHosts } from '../mta-sts/mx-hosts'
import type { MtaStsFormValues } from '../mta-sts/policy-change'

const props = defineProps<{
  domain: string
  caps: DnsCapabilities
  creating: boolean
  errorsFor: (path: string) => readonly string[]
}>()
const model = defineModel<MtaStsFormValues>({ required: true })
const { t, locale } = useI18n()

const used = computed(() => joinedLength(parseMxHosts(model.value.mx).hosts))
const showLength = computed(() => nearLimit(used.value, props.caps.mtaSts.mxMaxLength))
const number = (value: number) => formatNumber(value, locale.value as AppLocale)

function describedBy(id: string, path: string, extra: string[] = []): string {
  return [
    `${id}-help`,
    ...extra,
    ...(props.errorsFor(path).length > 0 ? [`${id}-error`] : []),
  ].join(' ')
}
const invalid = (path: string) => (props.errorsFor(path).length > 0 ? 'true' : undefined)

const CONTROL =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white'
const HELP = 'legacy-help text-sm text-gray-600 dark:text-gray-400'
const LABEL = 'text-sm font-medium text-gray-800 dark:text-gray-200'
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      v-if="creating"
      data-certificate-notice
      class="flex gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100"
    >
      <InfoIcon class="mt-0.5 size-4 shrink-0" />
      <p>{{ t('dns.mtaSts.certificateNotice', { domain }) }}</p>
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="mta-sts-version" :class="LABEL">{{ lt('edit.mta_sts_version') }}</label>
      <LegacyText id="mta-sts-version-help" k="edit.mta_sts_version_info" as="div" :class="HELP" />
      <select
        id="mta-sts-version"
        v-model="model.version"
        :class="CONTROL"
        :aria-describedby="describedBy('mta-sts-version', 'version')"
        :aria-invalid="invalid('version')"
      >
        <option value="STSv1">STSv1</option>
      </select>
      <FieldErrors id="mta-sts-version-error" :messages="errorsFor('version')" />
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="mta-sts-mode" :class="LABEL">{{ lt('edit.mta_sts_mode') }}</label>
      <LegacyText id="mta-sts-mode-help" k="edit.mta_sts_mode_info" as="div" :class="HELP" />
      <select
        id="mta-sts-mode"
        v-model="model.mode"
        :class="CONTROL"
        :aria-describedby="describedBy('mta-sts-mode', 'mode')"
        :aria-invalid="invalid('mode')"
      >
        <option v-for="mode in caps.mtaSts.modes" :key="mode" :value="mode">{{ mode }}</option>
      </select>
      <FieldErrors id="mta-sts-mode-error" :messages="errorsFor('mode')" />
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="mta-sts-max-age" :class="LABEL">{{ lt('edit.mta_sts_max_age') }}</label>
      <LegacyText id="mta-sts-max-age-help" k="edit.mta_sts_max_age_info" as="p" :class="HELP" />
      <input
        id="mta-sts-max-age"
        v-model="model.maxAge"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        autocomplete="off"
        :class="CONTROL"
        :aria-describedby="describedBy('mta-sts-max-age', 'maxAge')"
        :aria-invalid="invalid('maxAge')"
      />
      <FieldErrors id="mta-sts-max-age-error" :messages="errorsFor('maxAge')" />
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="mta-sts-mx" :class="LABEL">{{ lt('edit.mta_sts_mx') }}</label>
      <LegacyText id="mta-sts-mx-help" k="edit.mta_sts_mx_info" as="p" :class="HELP" />
      <textarea
        id="mta-sts-mx"
        v-model="model.mx"
        rows="5"
        autocapitalize="none"
        autocorrect="off"
        spellcheck="false"
        class="min-h-28 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        :aria-describedby="
          describedBy('mta-sts-mx', 'mxHosts', [
            'mta-sts-mx-notice',
            ...(showLength ? ['mta-sts-mx-length'] : []),
          ])
        "
        :aria-invalid="invalid('mxHosts')"
      />
      <LegacyText id="mta-sts-mx-notice" k="edit.mta_sts_mx_notice" as="p" :class="HELP" />
      <p
        v-if="showLength"
        id="mta-sts-mx-length"
        data-mx-length
        class="text-sm font-medium"
        :class="
          used > caps.mtaSts.mxMaxLength
            ? 'text-red-700 dark:text-red-300'
            : 'text-gray-800 dark:text-gray-200'
        "
      >
        {{ t('dns.mtaSts.mxLength', { used: number(used), max: number(caps.mtaSts.mxMaxLength) }) }}
      </p>
      <FieldErrors id="mta-sts-mx-error" :messages="errorsFor('mxHosts')" />
    </div>

    <div class="flex flex-col gap-1.5">
      <label
        class="flex min-h-11 cursor-pointer items-center gap-3 text-gray-800 dark:text-gray-200"
      >
        <input
          id="mta-sts-active"
          v-model="model.active"
          type="checkbox"
          class="size-5 shrink-0 accent-brand-500"
          :aria-describedby="describedBy('mta-sts-active', 'active')"
        />
        <span>{{ lt('edit.active') }}</span>
      </label>
      <LegacyText id="mta-sts-active-help" k="edit.mta_sts_active_info" as="p" :class="HELP" />
      <FieldErrors id="mta-sts-active-error" :messages="errorsFor('active')" />
    </div>
  </div>
</template>
