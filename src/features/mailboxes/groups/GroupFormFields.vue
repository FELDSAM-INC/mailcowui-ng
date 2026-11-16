<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { api, queryKeys, requireData } from '@/api'
import { domainPickerSource } from '@/features/aliases-common'
import DomainPicker, { type DomainPickerSource } from '@/shared/components/DomainPicker.vue'
import EntryListField from '@/shared/components/EntryListField.vue'
import FormField from '@/shared/components/FormField.vue'
import MailboxSearchPicker from '@/shared/components/MailboxSearchPicker.vue'
import { Badge } from '@/shared/ui/badge'
import { groupFieldId, type GroupForm } from './form'
import type { MailboxGroup } from './api'
import GroupGrantsEditor from './GroupGrantsEditor.vue'
const form = defineModel<GroupForm>({ required: true })
const props = defineProps<{
  creating: boolean
  admin: boolean
  stored?: MailboxGroup
  errorsFor: (path: string) => string[]
}>()
const { t } = useI18n()
const lockedMembers = computed(
  () => props.stored?.members.filter((member) => !member.editable) ?? [],
)
const flags = ['active', 'senderAllowed', 'sogoVisible', 'internal'] as const
const templates: DomainPickerSource = {
  id: 'group-templates',
  queryKey: (q) => [...queryKeys.mailboxTemplates.lists(), 'group-picker', q],
  async fetchPage({ q, offset, limit }) {
    const page = requireData(
      await api.GET('/mailbox-templates', {
        params: { query: { q, offset, limit, sort: 'name', order: 'asc' } },
      }),
    )
    return {
      items: page.data.map((item) => ({
        name: String(item.id),
        nameUnicode: item.name,
        detail: null,
      })),
      total: page.meta.total,
    }
  },
}
</script>
<template>
  <div class="grid min-w-0 gap-4 md:grid-cols-2">
    <DomainPicker
      v-if="creating"
      id="group-domain"
      :label="t('mailboxGroups.fields.domain')"
      :sources="[domainPickerSource()]"
      :model-value="form.domain || null"
      :errors="errorsFor('domain')"
      required
      @update:model-value="form.domain = typeof $event === 'string' ? $event : ''"
    />
    <FormField
      id="group-name"
      :label="t('mailboxGroups.fields.name')"
      :errors="errorsFor('name')"
      required
      ><template #default="control"
        ><input
          v-bind="control"
          v-model="form.name"
          class="form-control"
          required
          maxlength="100" /></template
    ></FormField>
    <FormField
      id="group-address"
      :label="t('mailboxGroups.fields.address')"
      :errors="errorsFor('address')"
      :description="t('mailboxGroups.addressHelp')"
      ><template #default="control"
        ><input
          v-bind="control"
          v-model="form.address"
          class="form-control"
          type="email"
          maxlength="255"
          :placeholder="form.domain ? `team\u0040${form.domain}` : ''" /></template
    ></FormField>
    <FormField
      id="group-description"
      :label="t('mailboxGroups.fields.description')"
      :errors="errorsFor('description')"
      class="md:col-span-2"
      ><template #default="control">
        <textarea
          v-bind="control"
          v-model="form.description"
          class="form-control"
          rows="2"
          maxlength="255"
        /></template
    ></FormField>
    <FormField
      v-for="flag in flags"
      :id="groupFieldId(flag)"
      :key="flag"
      :label="t(`mailboxGroups.fields.${flag}`)"
      :errors="errorsFor(flag)"
      ><template #default="control"
        ><input
          v-bind="control"
          v-model="form[flag]"
          type="checkbox"
          role="switch"
          class="size-5 accent-accent" /></template
    ></FormField>
  </div>
  <MailboxSearchPicker
    id="group-members"
    :label="t('mailboxGroups.fields.members')"
    :model-value="form.members"
    multiple
    :errors="errorsFor('members')"
    :description="t('mailboxGroups.membersHelp')"
    @update:model-value="form.members = Array.isArray($event) ? $event : []"
  />
  <div v-if="lockedMembers.length" class="space-y-2">
    <p class="text-sm text-muted">{{ t('mailboxGroups.lockedMembers') }}</p>
    <div class="flex flex-wrap gap-2">
      <Badge v-for="member in lockedMembers" :key="member.mailbox"
        >{{ member.mailbox }} ·
        {{
          member.source === 'idp'
            ? t('mailboxGroups.identityManaged')
            : t('mailboxGroups.outsideScope')
        }}</Badge
      >
    </div>
  </div>
  <EntryListField
    id="group-sendAs"
    v-model="form.sendAs"
    :label="t('mailboxGroups.fields.sendAs')"
    :rows="3"
    :errors="errorsFor('sendAs')"
    ><template #help>{{ t('mailboxGroups.sendAsHelp') }}</template></EntryListField
  >
  <GroupGrantsEditor v-model="form" :errors-for="errorsFor" />
  <fieldset v-if="admin" class="min-w-0 space-y-4 border-t border-line pt-4">
    <legend class="text-base font-semibold">{{ t('mailboxGroups.administration') }}</legend>
    <p class="text-sm text-muted">{{ t('mailboxGroups.templateHelp') }}</p>
    <DomainPicker
      id="group-templateId"
      :label="t('mailboxGroups.fields.templateId')"
      :sources="[templates]"
      :model-value="form.templateId === null ? null : String(form.templateId)"
      :errors="errorsFor('templateId')"
      @update:model-value="
        form.templateId = typeof $event === 'string' && $event ? Number($event) : null
      "
    />
    <FormField
      id="group-priority"
      :label="t('mailboxGroups.fields.priority')"
      :errors="errorsFor('priority')"
      ><template #default="control"
        ><input
          v-bind="control"
          v-model.number="form.priority"
          type="number"
          min="-1000000"
          max="1000000"
          step="1"
          required
          class="form-control" /></template
    ></FormField>
    <FormField
      id="group-identityReference"
      :label="t('mailboxGroups.fields.identityReference')"
      :errors="errorsFor('identityReference')"
      :description="t('mailboxGroups.identityReferenceHelp')"
      ><template #default="control"
        ><input
          v-bind="control"
          v-model="form.identityReference"
          maxlength="255"
          class="form-control" /></template
    ></FormField>
  </fieldset>
</template>
