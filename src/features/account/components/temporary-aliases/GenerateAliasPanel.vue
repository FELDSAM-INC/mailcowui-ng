<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, ref, useId, watch } from 'vue'
import { problemOf, type TemporaryAlias } from '@/api'
import { lt } from '@/i18n'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useSelfServiceCapabilities } from '@/shared/composables/useSelfServiceCapabilities'
import { buttonVariants } from '@/shared/ui/button'
import { createTemporaryAlias, useTemporaryAliasDomains } from '../../api/temporary-aliases'
import { defaultValidity, validityPatch, validityPresets, type AliasValidity } from '../../validity'
import AliasAddress from './AliasAddress.vue'
import ValiditySelect from './ValiditySelect.vue'

const props = defineProps<{ mailbox: string; canChange: boolean }>()
const emit = defineEmits<{ created: [value: TemporaryAlias] }>()
const { t } = useI18n()
const client = useQueryClient()
const domains = useTemporaryAliasDomains(() => props.mailbox)
const capabilities = useSelfServiceCapabilities()
const limits = computed(() => capabilities.data.value?.temporaryAliases)
const id = useId()
const domain = ref('')
const description = ref('')
const validity = ref<AliasValidity>('8760')
const initial = ref<{ domain: string; validity: AliasValidity } | null>(null)
const pending = ref(false)
const created = ref<TemporaryAlias | null>(null)
let disposed = false
onScopeDispose(() => {
  disposed = true
})
const form = useProblemForm({
  formKey: 'account.temporaryAliases.form',
  fieldId: (path) =>
    ['domain', 'description', 'lifetimeHours', 'permanent'].includes(path)
      ? `${id}-${path === 'domain' || path === 'description' ? path : 'validity'}`
      : null,
})
watch(
  [domains.data, limits],
  ([values, range]) => {
    if (values?.length && range && !initial.value) {
      domain.value = values[0]!.domain
      validity.value = defaultValidity(range)
      initial.value = { domain: domain.value, validity: validity.value }
    }
  },
  { immediate: true },
)
const dirty = computed(
  () =>
    !!initial.value &&
    (!!description.value ||
      domain.value !== initial.value.domain ||
      validity.value !== initial.value.validity),
)
useLeaveGuard(() => dirty.value || pending.value, 'leaveGuard.body')
async function submit() {
  if (!props.canChange || pending.value || !limits.value || !initial.value) return
  form.clear()
  const owner = props.mailbox
  if (!domains.data.value?.some((item) => item.domain === domain.value)) {
    await form.setClientMessages({ domain: [lt('danger.domain_invalid')] })
    return
  }
  if (!validityPresets(limits.value).some((item) => item.value === validity.value)) {
    await form.setClientMessages({ lifetimeHours: [lt('danger.validity_missing')] })
    return
  }
  pending.value = true
  try {
    const value = await createTemporaryAlias(client, owner, {
      domain: domain.value,
      description: description.value,
      ...validityPatch(validity.value),
    })
    if (disposed || props.mailbox !== owner) return
    created.value = value
    description.value = ''
    initial.value = { domain: domain.value, validity: validity.value }
    announce(`${lt('success.mailbox_modified', owner)} ${value.address}`)
    pending.value = false
    emit('created', value)
  } catch (error) {
    if (!disposed && props.mailbox === owner) {
      const problem = problemOf(error)
      if (problem) await form.setProblem(problem)
    }
  } finally {
    pending.value = false
  }
}
</script>
<template>
  <form class="flex flex-col gap-4" novalidate data-generate-alias @submit.prevent="submit">
    <ErrorSummary :id="form.summaryId" :items="form.summary.value" />
    <p v-if="domains.isPending.value || capabilities.isPending.value" role="status">
      {{ lt('datatables.loadingRecords') }}
    </p>
    <ProblemMessage
      v-if="domains.isError.value"
      :problem="problemOf(domains.error.value)"
      retry
      @retry="domains.refetch()"
    />
    <ProblemMessage
      v-if="capabilities.isError.value"
      :problem="problemOf(capabilities.error.value)"
      retry
      @retry="capabilities.refetch()"
    />
    <template v-if="initial && limits">
      <FormField
        v-if="(domains.data.value?.length ?? 0) > 1"
        :id="`${id}-domain`"
        :label="lt('add.domain')"
        :errors="form.errorsFor('domain')"
      >
        <template #default="control">
          <select
            v-bind="control"
            v-model="domain"
            name="domain"
            class="form-control"
            :disabled="pending || !canChange"
          >
            <option v-for="item in domains.data.value" :key="item.domain" :value="item.domain">
              @ {{ item.domainUnicode }}
            </option>
          </select>
        </template>
      </FormField>
      <FormField
        :id="`${id}-description`"
        :label="lt('user.description')"
        :errors="form.errorsFor('description')"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="description"
            name="description"
            type="text"
            class="form-control"
            :maxlength="capabilities.data.value?.limits?.descriptionMaxLength"
            :disabled="pending || !canChange"
          />
        </template>
      </FormField>
      <FormField
        :id="`${id}-validity`"
        :label="lt('user.alias_select_validity')"
        :errors="[...form.errorsFor('lifetimeHours'), ...form.errorsFor('permanent')]"
      >
        <template #default="control">
          <ValiditySelect
            v-bind="control"
            v-model="validity"
            :limits="limits"
            :disabled="pending || !canChange"
          />
        </template>
      </FormField>
      <ProblemMessage :problem="form.formProblem.value" />
      <button
        v-if="canChange"
        type="submit"
        :class="buttonVariants({ class: 'self-start' })"
        :disabled="pending"
        :aria-busy="pending"
      >
        {{ t('account.temporaryAliases.create') }}
      </button>
    </template>
    <div
      v-if="created"
      role="status"
      class="rounded-xl border border-green-300 bg-green-50 p-3 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
      data-new-alias
    >
      <p>{{ lt('success.mailbox_modified', mailbox) }}</p>
      <AliasAddress :address="created.address" />
    </div>
  </form>
</template>
