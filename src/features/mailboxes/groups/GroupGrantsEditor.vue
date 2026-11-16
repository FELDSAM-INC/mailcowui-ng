<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { lt } from '@/i18n'
import FormField from '@/shared/components/FormField.vue'
import MailboxSearchPicker from '@/shared/components/MailboxSearchPicker.vue'
import { buttonVariants } from '@/shared/ui/button'
import type { GroupForm } from './form'
import { groupFieldId } from './form'
const form = defineModel<GroupForm>({ required: true })
defineProps<{ errorsFor: (path: string) => string[] }>()
const { t } = useI18n()
const types = ['imapGrants', 'sogoGrants'] as const
function add(kind: (typeof types)[number]) {
  if (kind === 'imapGrants')
    form.value.imapGrants.push({ owner: '', rights: 'read', subscribe: true })
  else
    form.value.sogoGrants.push({
      owner: '',
      type: 'Calendar',
      folder: 'personal',
      access: 'read',
      subscribe: true,
    })
}
</script>
<template>
  <fieldset v-for="kind in types" :key="kind" class="min-w-0 space-y-3 border-t border-line pt-4">
    <legend class="text-base font-semibold">{{ t(`mailboxGroups.fields.${kind}`) }}</legend>
    <p class="text-sm text-muted">{{ t('mailboxGroups.sharingHelp') }}</p>
    <p v-for="error in errorsFor(kind)" :key="error" class="text-sm text-danger">{{ error }}</p>
    <div
      v-for="(grant, index) in form[kind]"
      :key="`${kind}-${index}`"
      class="grid min-w-0 gap-3 border-b border-line pb-4 md:grid-cols-2"
    >
      <MailboxSearchPicker
        :id="groupFieldId(`${kind}.${index}.owner`)"
        :label="t('mailboxGroups.owner')"
        :model-value="grant.owner"
        :errors="errorsFor(`${kind}.${index}.owner`)"
        required
        @update:model-value="grant.owner = typeof $event === 'string' ? $event : ''"
      />
      <FormField
        v-if="'rights' in grant"
        :id="groupFieldId(`${kind}.${index}.rights`)"
        :label="t('mailboxGroups.access')"
        :errors="errorsFor(`${kind}.${index}.rights`)"
        ><template #default="control"
          ><select v-bind="control" v-model="grant.rights" class="form-control">
            <option v-for="right in ['read', 'write', 'full']" :key="right" :value="right">
              {{ t(`mailboxGroups.rights.${right}`) }}
            </option>
          </select></template
        ></FormField
      >
      <template v-if="'type' in grant">
        <FormField
          :id="groupFieldId(`${kind}.${index}.type`)"
          :label="t('mailboxGroups.folderType')"
          :errors="errorsFor(`${kind}.${index}.type`)"
          ><template #default="control"
            ><select v-bind="control" v-model="grant.type" class="form-control">
              <option value="Calendar">{{ t('mailboxGroups.calendar') }}</option>
              <option value="Contacts">{{ t('mailboxGroups.contacts') }}</option>
            </select></template
          ></FormField
        >
        <FormField
          :id="groupFieldId(`${kind}.${index}.folder`)"
          :label="t('mailboxGroups.folder')"
          :errors="errorsFor(`${kind}.${index}.folder`)"
          ><template #default="control"
            ><input
              v-bind="control"
              v-model="grant.folder"
              required
              pattern="[A-Za-z0-9._-]{1,100}"
              class="form-control" /></template
        ></FormField>
        <FormField
          :id="groupFieldId(`${kind}.${index}.access`)"
          :label="t('mailboxGroups.access')"
          :errors="errorsFor(`${kind}.${index}.access`)"
          ><template #default="control"
            ><select v-bind="control" v-model="grant.access" class="form-control">
              <option v-for="right in ['read', 'write']" :key="right" :value="right">
                {{ t(`mailboxGroups.rights.${right}`) }}
              </option>
            </select></template
          ></FormField
        >
      </template>
      <FormField
        :id="groupFieldId(`${kind}.${index}.subscribe`)"
        :label="t('mailboxGroups.subscribe')"
        :errors="errorsFor(`${kind}.${index}.subscribe`)"
        ><template #default="control"
          ><input
            v-bind="control"
            v-model="grant.subscribe"
            type="checkbox"
            role="switch"
            class="size-5 accent-accent" /></template
      ></FormField>
      <button
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        class="self-end justify-self-start"
        @click="form[kind].splice(index, 1)"
      >
        {{ lt('mailbox.remove') }}
      </button>
    </div>
    <button type="button" :class="buttonVariants({ variant: 'outline' })" @click="add(kind)">
      {{ t('mailboxGroups.addShare') }}
    </button>
  </fieldset>
</template>
