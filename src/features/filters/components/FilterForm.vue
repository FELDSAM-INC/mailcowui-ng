<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { problemOf, type SieveFilter, type SieveFilterKind } from '@/api'
import { lt } from '@/i18n'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import MailboxSearchPicker from '@/shared/components/MailboxSearchPicker.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useSelfServiceCapabilities } from '@/shared/composables/useSelfServiceCapabilities'
import { buttonVariants } from '@/shared/ui/button'
import { createFilter, fetchFilter, updateFilter, validateScript } from '../api'
import ActivationWarning from './ActivationWarning.vue'
import ScriptEditor from './ScriptEditor.vue'

const props = defineProps<{ mailbox?: string; stored?: SieveFilter }>()
const emit = defineEmits<{ saved: [item: SieveFilter] }>()
const { t } = useI18n()
const client = useQueryClient()
const capabilities = useSelfServiceCapabilities()
const owner = ref<string | null>(props.stored?.mailbox ?? props.mailbox ?? null)
const description = ref(props.stored?.description ?? '')
const kind = ref<SieveFilterKind>(props.stored?.kind ?? 'prefilter')
const script = ref(props.stored?.script ?? '')
const active = ref(props.stored?.active ?? true)
const stored = shallowRef(props.stored)
const checking = ref(false)
const saving = ref(false)
const outdated = ref(false)
const saved = ref(false)
const checked = ref<string | null>(null)
let disposed = false
onScopeDispose(() => {
  disposed = true
})
const body = () => ({
  description: description.value.trim(),
  kind: kind.value,
  script: script.value,
  active: active.value,
})
const fingerprint = computed(() =>
  JSON.stringify([owner.value, description.value, kind.value, script.value, active.value]),
)
const baseline = ref(fingerprint.value)
const dirty = computed(() => fingerprint.value !== baseline.value)
const validated = computed(() => checked.value === fingerprint.value)
const form = useProblemForm({
  formKey: 'filters.form',
  fieldId: (name) =>
    ['mailbox', 'description', 'kind', 'script'].includes(name) ? `filter-${name}` : null,
})
useLeaveGuard(() => dirty.value || saving.value, 'leaveGuard.body')
watch(fingerprint, () => {
  checked.value = null
  saved.value = false
})
const maxBytes = computed(() => capabilities.data.value?.limits?.sieveScriptMaxBytes ?? 65535)
async function check() {
  if (checking.value || saving.value || disposed) return false
  form.clear()
  checked.value = null
  const errors: Record<string, string[]> = {}
  if (!owner.value) errors.mailbox = [lt('danger.no_user_defined')]
  if (!description.value.trim()) errors.description = [lt('danger.value_missing')]
  if (!script.value.trim()) errors.script = [lt('danger.script_empty')]
  if (Object.keys(errors).length) {
    await form.setClientMessages(errors)
    return false
  }
  const draft = fingerprint.value
  checking.value = true
  try {
    const result = await validateScript(script.value)
    if (disposed || draft !== fingerprint.value) return false
    if (!result.valid) {
      await form.setClientMessages({ script: [lt('danger.sieve_error', result.message ?? '')] })
      return false
    }
    checked.value = draft
    announce(lt('add.validation_success'))
    return true
  } catch (error) {
    if (!disposed && draft === fingerprint.value) await form.setProblem(problemOf(error))
    return false
  } finally {
    checking.value = false
  }
}
async function submit() {
  if (saving.value || checking.value || disposed) return
  if (stored.value ? !(await check()) : !validated.value) return
  if (!owner.value || disposed) return
  const mailbox = owner.value
  const draft = fingerprint.value
  saving.value = true
  form.clear()
  try {
    const item = stored.value
      ? await updateFilter(client, stored.value, body())
      : await createFilter(client, mailbox, body())
    if (disposed || draft !== fingerprint.value) return
    stored.value = item
    baseline.value = fingerprint.value
    outdated.value = false
    saved.value = true
    emit('saved', item)
    announce(lt('success.mailbox_modified', item.mailbox))
  } catch (error) {
    if (disposed || draft !== fingerprint.value) return
    const failure = problemOf(error)
    if (failure?.status === 412 && stored.value) {
      outdated.value = true
      try {
        const latest = await fetchFilter(mailbox, stored.value.id)
        if (!disposed && draft === fingerprint.value) stored.value = latest
      } catch (refreshError) {
        if (!disposed) await form.setProblem(problemOf(refreshError))
      }
    } else await form.setProblem(failure)
  } finally {
    saving.value = false
  }
}
function discard() {
  if (!stored.value) return
  description.value = stored.value.description
  kind.value = stored.value.kind
  script.value = stored.value.script
  active.value = stored.value.active
  baseline.value = fingerprint.value
  outdated.value = false
  form.clear()
}
</script>
<template>
  <form class="flex min-w-0 flex-col gap-4" novalidate data-filter-form @submit.prevent="submit">
    <ErrorSummary :id="form.summaryId" :items="form.summary.value" />
    <div
      v-if="outdated && stored"
      role="alert"
      data-outdated
      class="surface flex flex-col gap-2 text-amber-900 dark:text-amber-200"
    >
      <p class="font-semibold">{{ t('sections.outdated.title') }}</p>
      <p>{{ t('sections.outdated.body') }}</p>
      <p>
        {{ stored.description }} · {{ t(`filters.kind.${stored.kind}`) }} ·
        {{ lt(stored.active ? 'mailbox.active' : 'mailbox.inactive') }}
      </p>
      <pre class="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-sm">{{
        stored.script
      }}</pre>
      <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="discard">
        {{ t('sections.discard') }}
      </button>
    </div>
    <p v-if="saved" role="status" class="text-green-800 dark:text-green-200">
      {{ lt('success.mailbox_modified', owner ?? '') }}
    </p>
    <fieldset :disabled="saving" class="flex min-w-0 flex-col gap-4">
      <template v-if="!props.stored">
        <MailboxSearchPicker
          v-if="!props.mailbox"
          id="filter-mailbox"
          :model-value="owner"
          :label="lt('add.username')"
          :errors="form.errorsFor('mailbox')"
          required
          @update:model-value="owner = typeof $event === 'string' ? $event : null"
        />
        <FormField v-else id="filter-mailbox" :label="lt('add.username')"
          ><template #default="control"
            ><input v-bind="control" class="form-control" :value="owner" readonly /></template
        ></FormField>
      </template>
      <FormField
        v-if="props.stored"
        id="filter-description"
        :label="lt('edit.sieve_desc')"
        :errors="form.errorsFor('description')"
        required
      >
        <template #default="control"
          ><input v-bind="control" v-model="description" class="form-control" maxlength="255"
        /></template>
      </FormField>
      <FormField
        id="filter-kind"
        :label="lt(props.stored ? 'edit.sieve_type' : 'add.sieve_type')"
        :errors="form.errorsFor('kind')"
        required
      >
        <template #default="control"
          ><select v-bind="control" v-model="kind" class="form-control">
            <option value="prefilter">{{ t('filters.kind.prefilter') }}</option>
            <option value="postfilter">{{ t('filters.kind.postfilter') }}</option>
          </select></template
        >
      </FormField>
      <FormField
        v-if="!props.stored"
        id="filter-description"
        :label="lt('add.sieve_desc')"
        :errors="form.errorsFor('description')"
        required
      >
        <template #default="control"
          ><input v-bind="control" v-model="description" class="form-control" maxlength="255"
        /></template>
      </FormField>
      <ScriptEditor v-model="script" :max-bytes="maxBytes" :errors="form.errorsFor('script')" />
      <ActivationWarning v-if="!props.stored" :active="active" />
      <label class="flex min-h-11 items-center gap-3 text-sm text-gray-800 dark:text-gray-200"
        ><input v-model="active" type="checkbox" class="size-5" />{{
          lt(props.stored ? 'edit.active' : 'add.active')
        }}</label
      >
      <ProblemMessage :problem="form.formProblem.value" />
      <p v-if="validated && !props.stored" role="status" class="text-green-800 dark:text-green-200">
        {{ lt('add.validation_success') }}
      </p>
      <div class="flex flex-wrap gap-3">
        <button
          v-if="!props.stored"
          type="button"
          :disabled="checking"
          :class="buttonVariants({ variant: 'outline' })"
          @click="check"
        >
          {{ lt('add.validate') }}
        </button>
        <button
          type="submit"
          :disabled="checking || (!props.stored && !validated)"
          :class="buttonVariants({})"
        >
          {{
            outdated
              ? t('sections.saveAgain')
              : lt(props.stored ? 'edit.validate_save' : 'admin.add')
          }}
        </button>
      </div>
    </fieldset>
  </form>
</template>
