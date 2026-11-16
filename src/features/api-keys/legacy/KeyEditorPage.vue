<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { problemOf, queryKeys } from '@/api'
import { lt, text } from '@/i18n'
import PageHeader from '@/shared/components/PageHeader.vue'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import ValueList from '@/shared/components/ValueList.vue'
import OneTimeSecretDialog from '@/shared/components/OneTimeSecretDialog.vue'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useVersionedSave } from '@/shared/composables/useVersionedSave'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { confirm } from '@/shared/composables/useConfirm'
import { buttonVariants } from '@/shared/ui/button'
import {
  keys,
  detailKey,
  keyOptions,
  fetchKey,
  createKey,
  updateKey,
  regenerateKey,
  deleteKey,
  type LegacyKey,
  type KeyCreate,
  type KeyPatch,
} from './api'
import KeyFields from './KeyFields.vue'
const { t } = useI18n(),
  route = useRoute(),
  router = useRouter(),
  client = useQueryClient()
const creating = computed(() => route.name === 'legacy-api-key-create'),
  id = computed(() => Number(route.params.legacyKeyId))
const query = useQuery(computed(() => ({ ...keyOptions(id.value), enabled: !creating.value })))
const stored = computed(() => query.data.value),
  form = ref<KeyCreate>(),
  base = shallowRef<LegacyKey>(),
  busy = ref(false),
  secret = ref<string | null>(null),
  createdId = ref<number>()
const dialog = useTemplateRef<InstanceType<typeof OneTimeSecretDialog>>('dialog')
const values = (key?: LegacyKey): KeyCreate => ({
  description: key?.description ?? '',
  accessLevel: key?.accessLevel ?? 'readOnly',
  allowedNetworks: [...(key?.allowedNetworks ?? [])],
  skipIpCheck: key?.skipIpCheck ?? false,
  active: key?.active ?? true,
})
let initial = '',
  leaving = false
const errors = useProblemForm({ fieldId: (path) => `legacy-key-${path.replaceAll('.', '-')}` })
const leave = useLeaveGuard(
  () => !!form.value && JSON.stringify(form.value) !== initial,
  'leaveGuard.body',
)
const createRequest = useSecretRequest(createKey),
  regenerateRequest = useSecretRequest(regenerateKey)
const pending = computed(
  () =>
    busy.value ||
    createRequest.pending.value ||
    regenerateRequest.pending.value ||
    version.pending.value,
)
const version = useVersionedSave({
  current: () => base.value,
  refetch: async () => {
    const key = await fetchKey(id.value)
    base.value = key
    client.setQueryData(detailKey(id.value), key)
    return key
  },
})
watch(
  () => route.fullPath,
  () => {
    form.value = creating.value ? values() : undefined
    initial = JSON.stringify(form.value)
    errors.clear()
    version.discard()
  },
  { immediate: true },
)
function edit() {
  if (!stored.value || stored.value.service) return
  base.value = stored.value
  form.value = values(stored.value)
  initial = JSON.stringify(form.value)
  errors.clear()
  version.discard()
}
async function cancel() {
  if (!(await leave.ask())) return
  form.value = undefined
  version.discard()
  errors.clear()
}
async function updated(key: LegacyKey) {
  client.setQueryData(detailKey(key.id), key)
  await client.invalidateQueries({ queryKey: [...keys, 'list'] })
  await client.invalidateQueries({ queryKey: queryKeys.auditEvents.all() })
}
async function save() {
  if (!form.value || pending.value || secret.value) return
  errors.clear()
  const body = {
    ...form.value,
    allowedNetworks: (form.value.allowedNetworks ?? []).map((v) => v.trim()).filter(Boolean),
  }
  if (creating.value) {
    const result = await createRequest.run(body)
    if (!result) {
      await errors.setProblem(createRequest.problem.value)
      return
    }
    const { secret: token, ...metadata } = result
    createRequest.clear()
    form.value = undefined
    createdId.value = metadata.id
    secret.value = token
    await updated(metadata)
  } else {
    const original = JSON.parse(initial) as KeyCreate
    const patch: KeyPatch = Object.fromEntries(
      Object.entries(body).filter(
        ([key, value]) =>
          JSON.stringify(value) !== JSON.stringify(original[key as keyof KeyCreate]),
      ),
    )
    if (!Object.keys(patch).length) {
      form.value = undefined
      return
    }
    const result = await version.save(patch, (body, etag) => updateKey(id.value, body, etag))
    if (result.status === 'saved') {
      form.value = undefined
      await updated(result.result)
    } else if (result.status === 'failed') await errors.setProblem(result.problem)
  }
}
async function rotate() {
  if (!stored.value || pending.value || secret.value) return
  if (
    !(await confirm({
      title: t('legacyKeys.rotate'),
      description: t('legacyKeys.rotateConfirm'),
      confirmLabel: t('legacyKeys.rotate'),
      destructive: true,
    }))
  )
    return
  const result = await regenerateRequest.run(stored.value.id, stored.value.etag)
  if (!result) {
    await errors.setProblem(regenerateRequest.problem.value)
    if (regenerateRequest.problem.value?.status === 412) await query.refetch()
    return
  }
  const { secret: token, ...metadata } = result
  regenerateRequest.clear()
  secret.value = token
  await updated(metadata)
}
async function remove() {
  if (!stored.value || pending.value) return
  const ask = () =>
    confirm({
      title: t('legacyKeys.remove'),
      description: t('legacyKeys.removeConfirm'),
      confirmLabel: lt('mailbox.remove'),
      destructive: true,
    })
  if (!(await ask())) return
  base.value = stored.value
  busy.value = true
  try {
    const result = await version.remove((etag) => deleteKey(id.value, etag), ask)
    if (result.status === 'saved') {
      client.removeQueries({ queryKey: detailKey(id.value) })
      await client.invalidateQueries({ queryKey: keys })
      leave.disarm()
      await router.push({ name: 'legacy-api-keys' })
    } else if (result.status === 'failed') await errors.setProblem(result.problem)
  } finally {
    busy.value = false
  }
}
function closeSecret() {
  secret.value = null
  if (!leaving && creating.value && createdId.value)
    void router.replace({ name: 'legacy-api-key-detail', params: { legacyKeyId: createdId.value } })
}
onBeforeRouteLeave(async () => {
  if (secret.value === null) return true
  leaving = true
  try {
    return (await dialog.value?.requestClose()) ?? false
  } finally {
    leaving = false
  }
})
const items = computed(() =>
  stored.value
    ? ['description', 'prefix', 'accessLevel', 'allowedNetworks', 'skipIpCheck', 'active'].map(
        (key) => ({
          key,
          label: t(`legacyKeys.fields.${key}`),
          value:
            key === 'allowedNetworks'
              ? stored.value!.allowedNetworks.join(', ') || '—'
              : key === 'accessLevel'
                ? text(`enums.apiKeyAccessLevel.${stored.value!.accessLevel}`)
                : typeof stored.value![key as keyof LegacyKey] === 'boolean'
                  ? lt(stored.value![key as keyof LegacyKey] ? 'mailbox.yes' : 'mailbox.no')
                  : String(stored.value![key as keyof LegacyKey] || '—'),
        }),
      )
    : [],
)
</script>
<template>
  <section class="flex w-full min-w-0 flex-col gap-4">
    <PageHeader
      :title="creating ? t('legacyKeys.create') : stored?.description || t('legacyKeys.title')"
      :description="t('legacyKeys.intro')"
      ><template v-if="stored && !stored.service && !form" #actions
        ><button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="pending"
          @click="rotate"
        >
          {{ t('legacyKeys.rotate') }}</button
        ><button
          type="button"
          :class="buttonVariants({ variant: 'destructive' })"
          :disabled="pending"
          @click="remove"
        >
          {{ lt('mailbox.remove') }}
        </button></template
      ></PageHeader
    >
    <ProblemMessage
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    /><ErrorSummary :id="errors.summaryId" :items="errors.summary.value" /><ProblemMessage
      :problem="errors.formProblem.value"
    />
    <p
      v-if="stored?.service"
      role="status"
      class="rounded-lg border border-line bg-surface p-3 text-sm"
    >
      {{ t('legacyKeys.locked') }}
    </p>
    <form
      v-if="creating && form"
      class="space-y-5 rounded-2xl border border-line bg-surface p-4 md:p-6"
      @submit.prevent="save"
    >
      <fieldset :disabled="pending" class="space-y-4">
        <KeyFields v-model="form" :errors-for="errors.errorsFor" />
      </fieldset>
      <div class="flex justify-between gap-3 border-t border-line pt-4">
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          @click="router.push({ name: 'legacy-api-keys' })"
        >
          {{ lt('footer.cancel') }}</button
        ><button type="submit" :class="buttonVariants({})" :disabled="pending">
          {{ t('legacyKeys.create') }}
        </button>
      </div>
    </form>
    <EditableSection
      v-else-if="stored"
      section-id="legacy-api-key"
      :title="t('legacyKeys.settings')"
      :editable="!stored.service && !pending"
      :editing="!!form"
      :saving="version.pending.value"
      :version-changed="version.outdated.value"
      @edit="edit"
      @cancel="cancel"
      @save="save"
      @save-again="save"
      @discard="edit"
      ><ValueList :items="items" /><template #form
        ><fieldset v-if="form" :disabled="pending">
          <KeyFields v-model="form" :errors-for="errors.errorsFor" /></fieldset></template
    ></EditableSection>
    <OneTimeSecretDialog
      ref="dialog"
      :secret="secret"
      :title="t('apiKeys.secret.title')"
      :description="t('legacyKeys.secretHelp')"
      grouped
      @close="closeSecret"
    />
  </section>
</template>
