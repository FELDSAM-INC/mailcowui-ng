<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, shallowRef, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  problemOf,
  type AppPassword,
  type AppPasswordResult,
  type AppPasswordProtocol,
} from '@/api'
import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { buttonVariants } from '@/shared/ui/button'
import { APP_PASSWORD_PROTOCOL_ORDER, appPasswordProtocolKey } from '../../labels'
import {
  afterAppPasswordChange,
  createAppPassword,
  fetchAppPassword,
  updateAppPassword,
  withoutSecret,
} from '../../api/app-passwords'
import ProtocolSelect from './ProtocolSelect.vue'
const props = defineProps<{ mailbox: string; stored?: AppPassword; canChange: boolean }>()
const emit = defineEmits<{ saved: [value: AppPasswordResult | AppPassword] }>()
const { t } = useI18n()
const client = useQueryClient()
const id = useId()
const name = ref(props.stored?.name ?? '')
const active = ref(props.stored?.active ?? true)
const protocols = ref<AppPasswordProtocol[]>([
  ...(props.stored?.protocols ?? APP_PASSWORD_PROTOCOL_ORDER),
])
const baseline = shallowRef(props.stored)
const outdated = ref(false)
const saved = ref(false)
const saving = ref(false)
let disposed = false
onScopeDispose(() => {
  disposed = true
})
const request = useSecretRequest(createAppPassword)
const form = useProblemForm({ fieldId: (path) => (path === 'name' ? `${id}-name` : null) })
const dirty = computed(
  () =>
    name.value !== (baseline.value?.name ?? '') ||
    active.value !== (baseline.value?.active ?? true) ||
    JSON.stringify(protocols.value) !==
      JSON.stringify(baseline.value?.protocols ?? APP_PASSWORD_PROTOCOL_ORDER),
)
useLeaveGuard(() => dirty.value, 'leaveGuard.body')
watch(dirty, (changed) => {
  if (changed) saved.value = false
})
watch(
  () => props.stored,
  (value) => {
    if (value && !dirty.value && !outdated.value) {
      baseline.value = value
      name.value = value.name
      active.value = value.active
      protocols.value = [...value.protocols]
    }
  },
)
function discard() {
  if (!baseline.value) return
  name.value = baseline.value.name
  active.value = baseline.value.active
  protocols.value = [...baseline.value.protocols]
  outdated.value = false
  form.clear()
}
async function submit() {
  if (!props.canChange || saving.value || request.pending.value) return
  const owner = props.mailbox
  const objectId = props.stored?.id
  const currentContext = () => !disposed && props.mailbox === owner && props.stored?.id === objectId
  saved.value = false
  form.clear()
  if (!name.value.trim()) {
    await form.setClientErrors({ name: ['validation.required'] })
    return
  }
  saving.value = true
  try {
    const body = { name: name.value.trim(), active: active.value, protocols: [...protocols.value] }
    const value = baseline.value
      ? await updateAppPassword(client, props.mailbox, baseline.value.id, body, baseline.value.etag)
      : await request.run(owner, body)
    if (!currentContext()) {
      if (value && !disposed) afterAppPasswordChange(client, value)
      request.clear()
      return
    }
    if (!value) {
      if (request.problem.value) await form.setProblem(request.problem.value)
      return
    }
    afterAppPasswordChange(client, value)
    baseline.value = withoutSecret(value)
    name.value = value.name
    active.value = value.active
    protocols.value = [...value.protocols]
    outdated.value = false
    saved.value = true
    request.clear()
    announce(lt(props.stored ? 'success.object_modified' : 'success.app_passwd_added', value.name))
    emit('saved', value)
  } catch (error) {
    if (!currentContext()) {
      request.clear()
      return
    }
    const problem = problemOf(error)
    if (problem?.status === 412 && baseline.value) {
      outdated.value = true
      try {
        baseline.value = await fetchAppPassword(props.mailbox, baseline.value.id)
      } catch (refreshError) {
        const failure = problemOf(refreshError)
        if (failure) await form.setProblem(failure)
      }
      announce(t('sections.outdated.title'), { assertive: true })
    } else if (problem) await form.setProblem(problem)
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <form class="flex flex-col gap-4" novalidate data-app-password-form @submit.prevent="submit">
    <ErrorSummary :id="form.summaryId" :items="form.summary.value" />
    <p v-if="saved" role="status" class="text-green-800 dark:text-green-200">
      {{ lt(stored ? 'success.object_modified' : 'success.app_passwd_added', name) }}
    </p>
    <div
      v-if="outdated && baseline"
      role="alert"
      data-outdated
      class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      <p class="font-semibold">{{ t('sections.outdated.title') }}</p>
      <p>{{ t('sections.outdated.body') }}</p>
      <p>
        {{ t('sections.outdated.savedAs', { field: lt('edit.app_name'), value: baseline.name }) }}
      </p>
      <p>
        {{
          t('sections.outdated.savedAs', {
            field: lt('edit.active'),
            value: lt(baseline.active ? 'mailbox.active' : 'mailbox.inactive'),
          })
        }}
      </p>
      <p>
        {{
          t('sections.outdated.savedAs', {
            field: lt('edit.app_passwd_protocols'),
            value: baseline.protocols.map((p) => t(appPasswordProtocolKey(p))).join(', ') || '–',
          })
        }}
      </p>
      <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="discard">
        {{ t('sections.discard') }}
      </button>
    </div>
    <FormField
      :id="`${id}-name`"
      :label="lt(stored ? 'edit.app_name' : 'add.app_name')"
      :errors="form.errorsFor('name')"
      ><template #default="control"
        ><input
          v-bind="control"
          v-model="name"
          name="name"
          type="text"
          autocomplete="off"
          maxlength="255"
          class="form-control"
          :disabled="!canChange || saving" /></template
    ></FormField>
    <label
      v-if="stored"
      class="flex min-h-11 items-center gap-3 text-sm text-gray-800 dark:text-gray-200"
      ><input v-model="active" type="checkbox" class="size-5" :disabled="!canChange || saving" />{{
        lt('edit.active')
      }}</label
    >
    <ProtocolSelect v-model="protocols" :editing="!!stored" :disabled="!canChange || saving" />
    <label
      v-if="!stored"
      class="flex min-h-11 items-center gap-3 text-sm text-gray-800 dark:text-gray-200"
      ><input v-model="active" type="checkbox" class="size-5" :disabled="!canChange || saving" />{{
        lt('add.active')
      }}</label
    >
    <ProblemMessage :problem="form.formProblem.value" />
    <button
      v-if="canChange"
      type="submit"
      :disabled="saving || request.pending.value"
      :aria-busy="saving ? 'true' : 'false'"
      :class="buttonVariants({ class: 'self-start' })"
    >
      {{ outdated ? t('sections.saveAgain') : lt(stored ? 'edit.save' : 'admin.add') }}
    </button>
  </form>
</template>
