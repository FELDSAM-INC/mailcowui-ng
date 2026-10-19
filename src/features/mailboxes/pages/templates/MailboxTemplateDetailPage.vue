<script setup lang="ts">
// The mailbox template page (US7, FR-059, FR-061, FR-063): legacy's edit heading with the
// template's name and the way back, History for administrators, and one form as the classic edit
// page `edit/mailbox-templates.twig` has (owner rule 1:1), with its fields, labels, help texts and
// order, and "Save changes". The Default template's name is read-only, with the reason. An outdated
// save lists what changed in the meantime; leaving with unsaved changes asks first. Domain
// administrators read the values without a form. An unknown template shows the not-found page
// with a way back to the list (FR-004).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import { isApiProblem, problemOf } from '@/api'
import { canAccess } from '@/app/navigation/visibility'
import { useIdentityQuery } from '@/app/session/queries'
import NotFoundPage from '@/app/states/NotFoundPage.vue'
import { lt } from '@/i18n'
import { useFormat } from '@/i18n/format'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import FormField from '@/shared/components/FormField.vue'
import HistoryLink from '@/shared/components/HistoryLink.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import ValueList from '@/shared/components/ValueList.vue'
import { useLeaveGuard } from '@/shared/composables/useLeaveGuard'
import { WarningIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'
import { MAILBOX_TEMPLATE_NAME_MAX } from '@/shared/validation/limits'

import { PERMISSION_LABEL_KEYS, presentPermissions } from '../../acl'
import MailboxValueFields from '../../components/fields/MailboxValueFields.vue'
import { useMailboxCapabilities } from '../../composables/useMailboxCapabilities'
import { useTemplateDisplay } from '../../templates/display'
import { useTemplateEditForm } from '../../templates/useTemplateEditForm'
import { useTemplate } from '../../templates-api'

const ID_PREFIX = 'template-edit'

const { t } = useI18n()
const fmt = useFormat()
const route = useRoute()
const display = useTemplateDisplay()
const identityQuery = useIdentityQuery()
const identity = computed(() => identityQuery.data.value ?? null)
const manage = computed(() => identity.value?.role === 'admin')
const historyAllowed = computed(() => canAccess('auditLog', identity.value))
const capabilitiesQuery = useMailboxCapabilities()
const capabilities = computed(() => capabilitiesQuery.data.value)

const id = computed(() => Number(route.params.templateId))
const query = useTemplate(id)
const template = computed(() => query.data.value)
const notFound = computed(
  () => !template.value && isApiProblem(query.error.value) && query.error.value.status === 404,
)

const edit = useTemplateEditForm({ template: () => template.value, idPrefix: ID_PREFIX })
useLeaveGuard(edit.dirty, { messageKey: 'leaveGuard.body' })
const gone = computed(() => edit.problem.value?.status === 404)

const items = computed(() => {
  const item = template.value
  if (!item) return []
  const granted = presentPermissions(item.userPermissions)
    .filter((key) => item.userPermissions[key])
    .map((key) => lt(PERMISSION_LABEL_KEYS[key]))
  const tls = [
    item.tlsEnforceInbound ? lt('user.tls_enforce_in') : null,
    item.tlsEnforceOutbound ? lt('user.tls_enforce_out') : null,
  ].filter((value): value is string => value !== null)
  return [
    { key: 'name', label: lt('mailbox.template'), value: item.name },
    { key: 'tags', label: display.label('tags'), value: display.value('tags', item.tags) },
    { key: 'quota', label: display.label('quota'), value: display.quota(item.quota) },
    ...(['taggedMailHandling', 'quarantineNotification', 'quarantineCategory'] as const).map(
      (field) => ({
        key: field,
        label: display.label(field),
        value: display.value(field, item[field]),
      }),
    ),
    {
      key: 'tls',
      label: lt('user.tls_policy'),
      value: tls.length > 0 ? fmt.list(tls) : t('domains.values.none'),
    },
    {
      key: 'protocolAccess',
      label: display.label('protocolAccess'),
      value: display.value('protocolAccess', item.protocolAccess),
    },
    {
      key: 'userPermissions',
      label: display.label('userPermissions'),
      value: granted.length > 0 ? fmt.list(granted) : t('domains.values.none'),
    },
    {
      key: 'rateLimit',
      label: display.label('rateLimit'),
      value: display.value('rateLimit', item.rateLimit),
    },
    ...(['status', 'forcePasswordChange', 'forceSecondFactorSetup'] as const).map((field) => ({
      key: field,
      label: display.label(field),
      value: display.value(field, item[field]),
    })),
    ...(capabilities.value?.groupwareEnabled === false
      ? []
      : [
          {
            key: 'webmailRedirect',
            label: display.label('webmailRedirect'),
            value: display.yesNo(item.webmailRedirect),
          },
        ]),
  ]
})
</script>

<template>
  <NotFoundPage
    v-if="notFound"
    :back-to="{ name: 'mailbox-templates' }"
    :back-label="t('mailboxTemplates.detail.backToList')"
  />
  <div
    v-else-if="!template && query.isPending.value"
    data-page-loading
    role="status"
    aria-busy="true"
    class="mx-auto w-full max-w-3xl"
  >
    <p class="text-gray-600 dark:text-gray-400">{{ t('domainTemplates.detail.loading') }}</p>
  </div>
  <section v-else-if="!template" class="mx-auto flex w-full max-w-3xl flex-col gap-3">
    <h1
      tabindex="-1"
      class="text-2xl font-semibold text-gray-900 focus:outline-none dark:text-white"
    >
      {{ lt('edit.title') }}
    </h1>
    <p role="alert" class="font-medium text-gray-900 dark:text-white">
      {{ t('domainTemplates.detail.loadFailed') }}
    </p>
    <ProblemMessage :problem="problemOf(query.error.value)" retry @retry="query.refetch()" />
  </section>
  <article v-else class="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <RouterLink
      :to="{ name: 'mailbox-templates' }"
      class="inline-flex min-h-11 items-center self-start text-sm font-medium text-brand-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400"
    >
      <span aria-hidden="true">←&nbsp;</span>{{ lt('edit.previous') }}
    </RouterLink>
    <PageHeader :title="lt('edit.title')" :description="template.name">
      <template #actions>
        <HistoryLink
          target-type="mailboxTemplate"
          :target-id="String(template.id)"
          :allowed="historyAllowed"
        />
      </template>
    </PageHeader>

    <div
      v-if="!manage"
      data-template-values
      class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
    >
      <ValueList :items="items" />
    </div>

    <form
      v-else-if="edit.values.value"
      data-template-form
      class="flex min-w-0 flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
      novalidate
      @submit.prevent="edit.save()"
    >
      <ErrorSummary :id="edit.form.summaryId" :items="edit.form.summary.value" />
      <div v-if="gone" role="alert" class="flex flex-col items-start gap-2">
        <p class="font-medium text-gray-900 dark:text-white">
          {{ t('domainTemplates.edit.gone') }}
        </p>
        <RouterLink :to="{ name: 'mailbox-templates' }" class="text-link">
          {{ t('mailboxTemplates.detail.backToList') }}
        </RouterLink>
      </div>
      <ProblemMessage v-else :problem="edit.problem.value" retry @retry="edit.save()" />
      <div
        v-if="edit.outdated.value"
        data-outdated
        role="alert"
        class="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        <WarningIcon class="mt-0.5 size-5 shrink-0" />
        <div class="flex min-w-0 flex-col gap-2">
          <p class="font-medium">{{ t('sections.outdated.title') }}</p>
          <p>{{ t('sections.outdated.body') }}</p>
          <ul class="list-disc ps-5">
            <li v-for="change in edit.outdated.value" :key="change.field" class="break-words">
              {{ t('sections.outdated.savedAs', { field: change.label, value: change.saved }) }}
            </li>
          </ul>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              :class="buttonVariants({ variant: 'default', size: 'sm' })"
              :disabled="edit.pending.value"
              @click="edit.saveAgain()"
            >
              {{ t('sections.saveAgain') }}
            </button>
            <button
              type="button"
              :class="buttonVariants({ variant: 'outline', size: 'sm' })"
              @click="edit.discard()"
            >
              {{ t('sections.discard') }}
            </button>
          </div>
        </div>
      </div>
      <FormField
        :id="`${ID_PREFIX}-name`"
        :label="lt('mailbox.template')"
        required
        :description="template.isDefault ? t('domainTemplates.edit.defaultName') : undefined"
        :errors="edit.errorsFor('name')"
      >
        <template #default="control">
          <input
            v-bind="control"
            v-model="edit.name.value"
            type="text"
            autocomplete="off"
            :maxlength="MAILBOX_TEMPLATE_NAME_MAX"
            :readonly="template.isDefault"
            class="form-control read-only:bg-gray-50 dark:read-only:bg-gray-950"
          />
        </template>
      </FormField>
      <MailboxValueFields
        v-model="edit.values.value"
        :id-prefix="ID_PREFIX"
        :capabilities="capabilities"
        :errors-for="edit.errorsFor"
      />
      <div
        data-sticky-save
        class="sticky bottom-0 z-10 -mx-4 flex gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 sm:-mx-5 sm:px-5 dark:border-gray-800 dark:bg-gray-900/95"
      >
        <button
          type="submit"
          :class="buttonVariants({ variant: 'default' })"
          :disabled="edit.pending.value"
        >
          {{ edit.pending.value ? t('sections.saving') : lt('edit.save') }}
        </button>
      </div>
    </form>
  </article>
</template>
