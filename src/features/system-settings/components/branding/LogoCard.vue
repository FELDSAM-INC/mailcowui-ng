<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  problemOf,
  queryKeys,
  type FieldViolation,
  type LogoSetting,
  type SettingsCapabilities,
} from '@/api'
import { useBranding } from '@/app/branding/public-config'
import BrandLogo from '@/app/shell/BrandLogo.vue'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { confirm } from '@/shared/composables/useConfirm'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { buttonVariants } from '@/shared/ui/button'
import { deleteLogo, logoOptions, replaceLogo } from '../../api/branding'
import { useLogoCandidate } from '../../composables/useLogoCandidate'
import LogoPreview from './LogoPreview.vue'

const props = defineProps<{ variant: LogoSetting['variant']; capabilities: SettingsCapabilities }>()
const emit = defineEmits<{ dirty: [value: boolean] }>()
const { t } = useI18n(),
  format = useFormat(),
  client = useQueryClient()
const query = useQuery(logoOptions(props.variant)),
  { branding } = useBranding()
const candidate = useLogoCandidate(() => props.capabilities.logos)
const { value: selected, error: candidateError, pending: reading } = candidate
const pending = ref(false),
  outdated = ref(false),
  status = ref('')
const fileInput = ref<HTMLInputElement>()
const label = computed(() =>
  lt(props.variant === 'light' ? 'admin.logo_normal_label' : 'admin.logo_dark_label'),
)
const form = useProblemForm({
  fieldId: (field) => (field === 'body' ? `logo-${props.variant}-file` : null),
})
let disposed = false
watch(
  () => !!selected.value || pending.value || reading.value,
  (value) => emit('dirty', value),
  { immediate: true },
)
onScopeDispose(() => {
  disposed = true
  emit('dirty', false)
})

function errorText(error: Pick<FieldViolation, 'code' | 'params'>) {
  const params = error.params ?? {},
    cap = props.capabilities.logos
  if (error.code === 'unsupportedImageType')
    return `${lt('danger.invalid_mime_type')}. ${t('systemSettings.logos.allowed', { types: cap.acceptedMediaTypes.join(', ') })}`
  if (error.code === 'tooLong')
    return `${lt('danger.img_size_exceeded')}. ${t('systemSettings.logos.fileLimit', { limit: format.bytes(Number(params.max ?? cap.maxBytes)) })}`
  if (error.code === 'imageDimensionsExceeded')
    return `${lt('danger.img_dimensions_exceeded')}. ${t('systemSettings.logos.pixelLimit', { width: format.number(Number(params.maxWidth ?? cap.maxWidth)), height: format.number(Number(params.maxHeight ?? cap.maxHeight)) })}`
  if (error.code === 'unsafeSvgContent') {
    const known = [
      'notWellFormed',
      'rootNotSvg',
      'doctype',
      'styleImport',
      'scriptElement',
      'eventHandlerAttribute',
      'foreignContent',
      'scriptUrl',
      'externalReference',
    ]
    return t('systemSettings.logos.unsafe', {
      construct: t(
        `systemSettings.logos.construct.${known.includes(String(params.construct)) ? String(params.construct) : 'unknown'}`,
      ),
      line: format.number(Number(params.line ?? 1)),
    })
  }
  return lt('danger.img_invalid')
}
const errors = computed(() =>
  candidateError.value ? [errorText(candidateError.value)] : form.errorsFor('body'),
)
const canUpload = computed(() => {
  const item = selected.value,
    cap = props.capabilities.logos
  return (
    !!item &&
    !pending.value &&
    !reading.value &&
    !props.capabilities.demoMode &&
    item.file.size <= cap.maxBytes &&
    (item.width === null || item.width <= cap.maxWidth) &&
    (item.height === null || item.height <= cap.maxHeight)
  )
})
async function choose(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  if (!file || pending.value || props.capabilities.demoMode) return
  status.value = ''
  outdated.value = false
  form.clear()
  await candidate.choose(file)
  input.value = ''
}
function cancel() {
  if (!pending.value) {
    candidate.clear()
    form.clear()
    outdated.value = false
  }
}
async function failure(error: unknown) {
  const problem = problemOf(error)
  if (problem?.is('demo-mode'))
    void client.invalidateQueries({ queryKey: queryKeys.systemSettings.capabilities() })
  if (problem?.status === 422 && problem.fieldErrors.has('body')) {
    await form.setClientMessages({ body: problem.fieldErrors.get('body')!.map(errorText) })
    void client.invalidateQueries({ queryKey: queryKeys.systemSettings.capabilities() })
  } else await form.setProblem(problem)
}
async function upload() {
  if (!canUpload.value || !query.data.value || !selected.value || disposed) return
  pending.value = true
  status.value = ''
  form.clear()
  try {
    await replaceLogo(client, query.data.value, selected.value.file, selected.value.mediaType)
    if (disposed) return
    candidate.clear()
    outdated.value = false
    status.value = lt('success.upload_success')
    announce(status.value)
  } catch (error) {
    if (disposed) return
    if (problemOf(error)?.status === 412) {
      outdated.value = true
      try {
        await client.fetchQuery({ ...logoOptions(props.variant), staleTime: 0 })
      } catch (refreshError) {
        if (!disposed) await failure(refreshError)
      }
    } else await failure(error)
  } finally {
    pending.value = false
  }
}
async function remove() {
  if (!query.data.value?.isSet || pending.value || disposed || props.capabilities.demoMode) return
  pending.value = true
  form.clear()
  status.value = ''
  let current = query.data.value
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (
        !(await confirm({
          title: attempt ? t('sections.outdated.title') : lt('admin.reset_default'),
          description: t('systemSettings.logos.resetDescription', { variant: label.value }),
          confirmLabel: lt('admin.reset_default'),
          destructive: true,
          content: { component: BrandLogo, props: { src: current.url } },
        }))
      )
        return
      if (disposed || props.capabilities.demoMode) return
      try {
        await deleteLogo(client, current)
      } catch (error) {
        if (problemOf(error)?.status !== 412 || attempt) throw error
        current = await client.fetchQuery({ ...logoOptions(props.variant), staleTime: 0 })
        if (disposed) return
        continue
      }
      if (!disposed) {
        status.value = lt('success.reset_main_logo')
        announce(status.value)
      }
      return
    }
  } catch (error) {
    if (!disposed) await failure(error)
  } finally {
    pending.value = false
  }
}
</script>
<template>
  <section
    class="surface min-w-0 space-y-4"
    :data-logo-card="variant"
    :aria-labelledby="`logo-${variant}-heading`"
  >
    <h2 :id="`logo-${variant}-heading`" class="text-lg font-semibold">{{ label }}</h2>
    <p v-if="query.isPending.value" role="status" aria-busy="true">{{ lt('footer.loading') }}</p>
    <ProblemMessage
      v-else-if="!query.data.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <template v-else>
      <div data-logo-current class="min-w-0 space-y-3">
        <p v-if="query.data.value.isSet" class="text-sm">
          {{ query.data.value.mediaType }} · {{ format.bytes(query.data.value.sizeBytes ?? 0) }} ·
          {{
            query.data.value.width !== null && query.data.value.height !== null
              ? `${format.number(query.data.value.width)} × ${format.number(query.data.value.height)}`
              : t('systemSettings.logos.noDimensions')
          }}
        </p>
        <p v-else data-logo-default class="text-sm">{{ t('systemSettings.logos.default') }}</p>
        <LogoPreview :src="query.data.value.url ?? branding.logos[variant]" :variant="variant" />
      </div>
      <p v-if="capabilities.demoMode" role="status" data-demo-mode>
        {{ lt('danger.demo_mode_enabled') }}
      </p>
      <ErrorSummary :id="form.summaryId" :items="form.summary.value" />
      <ProblemMessage :problem="form.formProblem.value" />
      <p v-if="outdated" role="alert" data-logo-outdated>{{ t('sections.outdated.body') }}</p>
      <p v-if="status" role="status" class="text-green-800 dark:text-green-200">{{ status }}</p>
      <FormField :id="`logo-${variant}-file`" :label="label" :errors="errors">
        <template #default="control"
          ><input
            v-bind="control"
            ref="fileInput"
            type="file"
            :accept="capabilities.logos.acceptedMediaTypes.join(',')"
            :disabled="pending || capabilities.demoMode"
            class="block min-h-11 w-full min-w-0 text-sm file:me-3 file:min-h-11 file:max-w-full file:rounded-lg file:border file:border-gray-400 file:px-3"
            @change="choose"
        /></template>
      </FormField>
      <p v-if="reading" role="status" aria-busy="true">{{ lt('footer.loading') }}</p>
      <div v-if="selected" data-logo-candidate class="min-w-0 space-y-3">
        <p class="wrap-anywhere">
          {{ selected.file.name }} · {{ selected.mediaType }} ·
          {{ format.bytes(selected.file.size) }}
        </p>
        <LogoPreview :src="selected.url" :variant="variant" />
        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            :disabled="!canUpload"
            :class="buttonVariants({})"
            :aria-busy="pending"
            @click="upload"
          >
            {{ lt('admin.upload') }}
          </button>
          <button
            type="button"
            :disabled="pending"
            :class="buttonVariants({ variant: 'outline' })"
            @click="cancel"
          >
            {{ lt('footer.cancel') }}
          </button>
        </div>
      </div>
      <button
        v-if="query.data.value.isSet"
        type="button"
        data-logo-reset
        :disabled="pending || capabilities.demoMode"
        :class="buttonVariants({ variant: 'outline' })"
        @click="remove"
      >
        {{ lt('admin.reset_default') }}
      </button>
    </template>
  </section>
</template>
