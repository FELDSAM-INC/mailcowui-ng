<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onScopeDispose, reactive, ref, shallowRef, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  problemOf,
  type ApiProblem,
  type PushNotificationSettings,
  type PushNotificationSettingsReplacement,
  type Writable,
} from '@/api'
import { hasMessage, lt } from '@/i18n'
import { useProblemMessages } from '@/i18n/problems'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import SanitizedHtml from '@/shared/components/SanitizedHtml.vue'
import { announce } from '@/shared/composables/useAnnouncer'
import { confirm } from '@/shared/composables/useConfirm'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { useProblemForm } from '@/shared/composables/useProblemForm'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { useSelfServiceCapabilities } from '@/shared/composables/useSelfServiceCapabilities'
import { buttonVariants } from '@/shared/ui/button'
import {
  afterPushSettingsChange,
  deletePushSettings,
  fetchPushSettings,
  replacePushSettings,
  usePushSettings,
  verifyPushSettings,
} from '../../api/push-notifications'
import WriteOnlySecretField from './WriteOnlySecretField.vue'

const props = withDefaults(
  defineProps<{ mailbox: string; canChange: boolean; mailboxContext?: boolean }>(),
  { mailboxContext: false },
)
const emit = defineEmits<{ saved: [value: PushNotificationSettings] }>()
const { t } = useI18n()
const { violationMessageIn } = useProblemMessages()
const client = useQueryClient()
const id = useId()
const query = usePushSettings(() => props.mailbox)
const capabilities = useSelfServiceCapabilities()
const baseline = shallowRef<PushNotificationSettings | null>(null)
const token = ref('')
const userKey = ref('')
const fields = reactive({
  title: '',
  text: '',
  senders: '',
  senderPattern: '',
  sound: 'pushover',
  active: true,
  evaluatePriority: false,
  onlyHighPriority: false,
})
const advanced = ref<HTMLDetailsElement | null>(null)
const saved = ref(false)
const outdated = ref(false)
const working = ref(false)
const verdict = ref<string | null>(null)
const actionProblem = shallowRef<ApiProblem | null>(null)
const lastAction = ref<'verify' | 'remove'>('verify')
let disposed = false
onScopeDispose(() => {
  disposed = true
  token.value = ''
  userKey.value = ''
})
const labels = computed(() =>
  props.mailboxContext
    ? ({
        info: 'user.pushover_info',
        vars: 'edit.pushover_vars',
        title: 'edit.pushover_title',
        text: 'edit.pushover_text',
        senders: 'edit.pushover_sender_array',
        senderPattern: 'edit.pushover_sender_regex',
        active: 'edit.active',
        advanced: 'edit.advanced_settings',
        evaluatePriority: 'edit.pushover_evaluate_x_prio',
        onlyHighPriority: 'edit.pushover_only_x_prio',
        save: 'edit.save',
        verify: 'edit.pushover_verify',
        remove: 'edit.remove',
      } as const)
    : ({
        info: 'user.pushover_info',
        vars: 'edit.pushover_vars',
        title: 'user.pushover_title',
        text: 'user.pushover_text',
        senders: 'user.pushover_sender_array',
        senderPattern: 'user.pushover_sender_regex',
        active: 'user.active',
        advanced: 'user.advanced_settings',
        evaluatePriority: 'user.pushover_evaluate_x_prio',
        onlyHighPriority: 'user.pushover_only_x_prio',
        save: 'user.save',
        verify: 'user.pushover_verify',
        remove: 'user.remove',
      } as const),
)
const fieldNames = [
  'token',
  'userKey',
  'title',
  'text',
  'senders',
  'senderPattern',
  'sound',
  'active',
  'evaluatePriority',
  'onlyHighPriority',
]
const form = useProblemForm({
  fieldId: (path) =>
    fieldNames.includes(path.split('.')[0]!) ? `${id}-${path.split('.')[0]}` : null,
})
const body = (): Writable<PushNotificationSettingsReplacement> => ({
  title: fields.title,
  text: fields.text,
  senders: fields.senders
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  senderPattern: fields.senderPattern,
  sound: fields.sound,
  active: fields.active,
  evaluatePriority: fields.evaluatePriority,
  onlyHighPriority: fields.onlyHighPriority,
  ...(token.value ? { token: token.value } : {}),
  ...(userKey.value ? { userKey: userKey.value } : {}),
})
function storedFields(value: PushNotificationSettings) {
  return {
    title: value.title,
    text: value.text,
    senders: value.senders.join(', '),
    senderPattern: value.senderPattern,
    sound: value.sound,
    active: value.active,
    evaluatePriority: value.evaluatePriority,
    onlyHighPriority: value.onlyHighPriority,
  }
}
const dirty = computed(
  () =>
    !!baseline.value &&
    (!!token.value ||
      !!userKey.value ||
      JSON.stringify(fields) !== JSON.stringify(storedFields(baseline.value))),
)
const save = useSecretRequest(
  async (
    owner: string,
    replacement: Writable<PushNotificationSettingsReplacement>,
    etag: string,
  ) => {
    const result = await replacePushSettings(owner, replacement, etag)
    afterPushSettingsChange(client, owner, result)
    return result
  },
)
const busy = computed(() => working.value || save.pending.value)
useLeaveGuard(() => dirty.value || busy.value, 'leaveGuard.body')
watch(dirty, (value) => {
  if (value) saved.value = false
})
watch(
  query.data,
  (value) => {
    if (value && !dirty.value && !outdated.value) {
      baseline.value = value
      Object.assign(fields, storedFields(value))
    }
  },
  { immediate: true },
)
const sounds = computed(() => [
  ...new Set([
    ...(capabilities.data.value?.pushoverSounds ?? []),
    baseline.value?.sound ?? 'pushover',
  ]),
])
const soundLabel = (value: string) =>
  hasMessage(`account.push.sounds.${value}`) ? t(`account.push.sounds.${value}`) : value
const vars = [
  '{SUBJECT}',
  '{SENDER}',
  '{SENDER_ADDRESS}',
  '{SENDER_NAME}',
  '{TO_NAME}',
  '{TO_ADDRESS}',
  '{MSG_ID}',
]
function discard() {
  if (baseline.value) Object.assign(fields, storedFields(baseline.value))
  token.value = ''
  userKey.value = ''
  outdated.value = false
  form.clear()
}
async function failure(problem: ApiProblem) {
  if (problem.status === 412) {
    const owner = props.mailbox
    outdated.value = true
    working.value = true
    try {
      const current = await fetchPushSettings(owner)
      if (disposed || owner !== props.mailbox) return
      baseline.value = current
      announce(t('sections.outdated.title'), { assertive: true })
    } finally {
      working.value = false
    }
    return
  }
  if (problem.fieldErrors.size) {
    const messages: Record<string, string[]> = {}
    for (const [path, rules] of problem.fieldErrors) {
      const field = path.split('.')[0]!
      if (
        ['senderPattern', 'evaluatePriority', 'onlyHighPriority'].includes(field) &&
        advanced.value
      )
        advanced.value.open = true
      messages[field] = [
        ...(messages[field] ?? []),
        ...rules.map((rule) => {
          if ((field === 'token' || field === 'userKey') && rule.code === 'secretRequired')
            return lt('danger.pushover_credentials_missing')
          if ((field === 'token' || field === 'userKey') && rule.code === 'invalidFormat')
            return lt(field === 'token' ? 'danger.pushover_token' : 'danger.pushover_key')
          if (field === 'senderPattern' && rule.code === 'invalidRegex')
            return t('account.push.errors.invalidRegex')
          return violationMessageIn(rule, { path })
        }),
      ]
    }
    await form.setClientMessages(messages)
  } else await form.setProblem(problem)
}
async function submit() {
  if (!props.canChange || busy.value || !baseline.value) return
  form.clear()
  saved.value = false
  verdict.value = null
  actionProblem.value = null
  const messages: Record<string, string[]> = {}
  for (const [key, value, stored] of [
    ['token', token.value, baseline.value.tokenSet],
    ['userKey', userKey.value, baseline.value.userKeySet],
  ] as const) {
    if (!value && !stored) messages[key] = [lt('danger.pushover_credentials_missing')]
    else if (value && !/^[A-Za-z0-9]{30}$/.test(value))
      messages[key] = [lt(key === 'token' ? 'danger.pushover_token' : 'danger.pushover_key')]
  }
  const replacement = body()
  const sendersMax = capabilities.data.value?.limits?.pushSendersMax ?? 100
  if (replacement.senders.length > sendersMax)
    messages.senders = [t('validation.tooMany', { max: sendersMax })]
  if (replacement.senders.some((sender) => sender.length > 255))
    messages.senders = [...(messages.senders ?? []), t('validation.tooLong', { max: 255 })]
  if (Object.keys(messages).length) {
    await form.setClientMessages(messages)
    return
  }
  const owner = props.mailbox
  const value = await save.run(owner, replacement, baseline.value.etag)
  if (disposed || owner !== props.mailbox) {
    save.clear()
    return
  }
  if (!value) {
    if (save.problem.value) {
      try {
        await failure(save.problem.value)
      } catch (error) {
        const problem = problemOf(error)
        if (problem) await form.setProblem(problem)
      }
    }
    return
  }
  baseline.value = value
  Object.assign(fields, storedFields(value))
  token.value = ''
  userKey.value = ''
  outdated.value = false
  saved.value = true
  save.clear()
  announce(lt('success.pushover_settings_edited'))
  emit('saved', value)
}
async function action(kind: 'verify' | 'remove') {
  if (!props.canChange || busy.value || !baseline.value) return
  const owner = props.mailbox
  if (
    kind === 'remove' &&
    !(await confirm({
      title: lt('user.delete_ays'),
      confirmLabel: lt(labels.value.remove),
      destructive: true,
    }))
  )
    return
  if (disposed || owner !== props.mailbox || !props.canChange || busy.value) return
  working.value = true
  lastAction.value = kind
  actionProblem.value = null
  verdict.value = null
  try {
    if (kind === 'verify') {
      const result = await verifyPushSettings(client, owner)
      if (disposed || owner !== props.mailbox) return
      verdict.value = result.accepted
        ? t('account.push.verify.accepted')
        : `${t('account.push.verify.rejected')}${result.reason ? `: ${result.reason}` : ''}`
      announce(verdict.value)
    } else {
      await deletePushSettings(client, owner, baseline.value.etag)
      const empty = await fetchPushSettings(owner)
      if (disposed || owner !== props.mailbox) return
      baseline.value = empty
      discard()
      afterPushSettingsChange(client, owner, empty)
      saved.value = true
      announce(lt('success.pushover_settings_edited'))
      emit('saved', empty)
    }
  } catch (error) {
    if (disposed || owner !== props.mailbox) return
    const problem = problemOf(error)
    if (problem?.status === 412) {
      try {
        await failure(problem)
      } catch (refreshError) {
        actionProblem.value = problemOf(refreshError)
      }
    } else actionProblem.value = problem
  } finally {
    working.value = false
  }
}
</script>
<template>
  <form novalidate class="flex flex-col gap-4" data-push-form @submit.prevent="submit">
    <p v-if="query.isPending.value" role="status" aria-busy="true">
      {{ lt('datatables.loadingRecords') }}
    </p>
    <ProblemMessage
      v-if="query.isError.value"
      :problem="problemOf(query.error.value)"
      retry
      @retry="query.refetch()"
    />
    <template v-if="baseline">
      <SanitizedHtml
        :html="lt(labels.info, mailbox)"
        class="text-sm text-gray-700 dark:text-gray-300"
      />
      <div class="text-sm text-gray-700 dark:text-gray-300">
        <LegacyText :k="labels.vars" />:
        <template v-for="(variable, index) in vars" :key="variable">
          <code>{{ variable }}</code
          ><span v-if="index < vars.length - 1">, </span>
        </template>
      </div>
      <ErrorSummary :id="form.summaryId" :items="form.summary.value" />
      <p v-if="saved" role="status" class="text-green-800 dark:text-green-200">
        {{ lt('success.pushover_settings_edited') }}
      </p>
      <div
        v-if="outdated"
        role="alert"
        data-outdated
        class="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
      >
        <p class="font-semibold">{{ t('sections.outdated.title') }}</p>
        <p>{{ t('sections.outdated.body') }}</p>
        <p>
          {{
            t('sections.outdated.savedAs', {
              field: lt(labels.title),
              value: baseline.title || t('account.push.titlePlaceholder'),
            })
          }}
        </p>
        <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="discard">
          {{ t('sections.discard') }}
        </button>
      </div>
      <WriteOnlySecretField
        :id="`${id}-token`"
        v-model="token"
        name="token"
        :label="t('account.push.token')"
        :stored="baseline.tokenSet"
        :disabled="busy || !canChange"
        :errors="form.errorsFor('token')"
      />
      <WriteOnlySecretField
        :id="`${id}-userKey`"
        v-model="userKey"
        name="userKey"
        :label="t('account.push.userKey')"
        :stored="baseline.userKeySet"
        :disabled="busy || !canChange"
        :errors="form.errorsFor('userKey')"
      />
      <FormField :id="`${id}-title`" :label="lt(labels.title)" :errors="form.errorsFor('title')"
        ><template #default="control">
          <input
            v-bind="control"
            v-model="fields.title"
            name="title"
            type="text"
            class="form-control"
            :maxlength="capabilities.data.value?.limits?.pushTitleMaxLength ?? 250"
            :placeholder="t('account.push.titlePlaceholder')"
            :disabled="busy || !canChange"
          /> </template
      ></FormField>
      <FormField :id="`${id}-text`" :label="lt(labels.text)" :errors="form.errorsFor('text')"
        ><template #default="control">
          <input
            v-bind="control"
            v-model="fields.text"
            name="text"
            type="text"
            class="form-control"
            :maxlength="capabilities.data.value?.limits?.pushTextMaxLength ?? 1024"
            :placeholder="t('account.push.textPlaceholder')"
            :disabled="busy || !canChange"
          /> </template
      ></FormField>
      <FormField
        :id="`${id}-senders`"
        :label="lt(labels.senders)"
        :errors="form.errorsFor('senders')"
      >
        <template #label><LegacyText :k="labels.senders" /></template>
        <template #default="control"
          ><input
            v-bind="control"
            v-model="fields.senders"
            name="senders"
            type="text"
            class="form-control"
            :placeholder="t('account.push.sendersPlaceholder')"
            :disabled="busy || !canChange"
        /></template>
      </FormField>
      <FormField
        :id="`${id}-sound`"
        :label="lt('edit.pushover_sound')"
        :errors="form.errorsFor('sound')"
        ><template #default="control">
          <select
            v-bind="control"
            v-model="fields.sound"
            name="sound"
            class="form-control"
            :disabled="busy || !canChange"
          >
            <option v-for="sound in sounds" :key="sound" :value="sound">
              {{ soundLabel(sound) }}
            </option>
          </select>
        </template></FormField
      >
      <label class="flex min-h-11 items-center gap-3 text-sm text-gray-800 dark:text-gray-200"
        ><input
          :id="`${id}-active`"
          v-model="fields.active"
          type="checkbox"
          class="size-5"
          :disabled="busy || !canChange"
        />{{ lt(labels.active) }}</label
      >
      <details ref="advanced" class="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
        <summary class="flex min-h-11 cursor-pointer items-center text-gray-800 dark:text-gray-200">
          {{ lt(labels.advanced) }}
        </summary>
        <div class="mt-3 flex flex-col gap-4">
          <FormField
            :id="`${id}-senderPattern`"
            :label="lt(labels.senderPattern)"
            :errors="form.errorsFor('senderPattern')"
            ><template #default="control">
              <input
                v-bind="control"
                v-model="fields.senderPattern"
                name="senderPattern"
                type="text"
                class="form-control"
                :maxlength="capabilities.data.value?.limits?.pushSenderPatternMaxLength ?? 1024"
                :placeholder="t('account.push.senderPatternPlaceholder')"
                :disabled="busy || !canChange"
              /> </template
          ></FormField>
          <label
            v-for="field in ['evaluatePriority', 'onlyHighPriority'] as const"
            :key="field"
            class="flex min-h-11 items-center gap-3 text-sm text-gray-800 dark:text-gray-200"
            ><input
              :id="`${id}-${field}`"
              v-model="fields[field]"
              type="checkbox"
              class="size-5 shrink-0"
              :disabled="busy || !canChange" /><LegacyText :k="labels[field]"
          /></label>
        </div>
      </details>
      <ProblemMessage :problem="form.formProblem.value" />
      <ProblemMessage :problem="actionProblem" retry @retry="action(lastAction)" />
      <p v-if="verdict" role="status" class="wrap-anywhere text-gray-800 dark:text-gray-200">
        {{ verdict }}
      </p>
      <div v-if="canChange" class="flex flex-wrap gap-2">
        <button
          type="submit"
          :class="buttonVariants({})"
          :disabled="busy"
          :aria-busy="save.pending.value"
        >
          {{ outdated ? t('sections.saveAgain') : lt(labels.save) }}
        </button>
        <button
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="busy"
          @click="action('verify')"
        >
          {{ lt(labels.verify) }}
        </button>
        <button
          v-if="baseline.configured"
          type="button"
          :class="buttonVariants({ variant: 'outline' })"
          :disabled="busy"
          @click="action('remove')"
        >
          {{ lt(labels.remove) }}
        </button>
      </div>
    </template>
  </form>
</template>
