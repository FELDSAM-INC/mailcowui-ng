<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { api, queryKeys, requireData } from '@/api'
import { lt } from '@/i18n'
import DomainPicker, { type DomainPickerSource } from '@/shared/components/DomainPicker.vue'
import MailboxSearchPicker from '@/shared/components/MailboxSearchPicker.vue'
import FormField from '@/shared/components/FormField.vue'
import LegacyText from '@/shared/components/LegacyText.vue'
import { buttonVariants } from '@/shared/ui/button'
import { parseEntryList } from '@/shared/validation/entry-list'
import type { SelectionDraft } from '../../lib/selection'

const draft = defineModel<SelectionDraft>('draft', { required: true })
const props = defineProps<{ errors: (path: string) => string[]; max: number }>()
const { t } = useI18n(),
  pasted = ref('')
const source: DomainPickerSource = {
  id: 'mass-mail-domains',
  queryKey: (q) => queryKeys.domains.list({ q, limit: 25, offset: 0 }),
  async fetchPage({ q, limit, offset }) {
    const result = requireData(
      await api.GET('/domains', { params: { query: { q: q || undefined, limit, offset } } }),
    )
    return {
      items: result.data.map((domain) => ({ name: domain.name, nameUnicode: domain.unicodeName })),
      total: result.meta.total,
    }
  },
}
const domains = computed(() =>
  draft.value.scope === 'domains' && draft.value.domains.length <= 100
    ? draft.value.domains
    : undefined,
)
const mailboxErrors = computed(() =>
  Object.fromEntries(
    draft.value.mailboxes.map((address, i) => [
      address,
      props.errors(`selection.${draft.value.listMode}.${i}`),
    ]),
  ),
)
const domainErrors = computed(() =>
  Object.fromEntries(
    draft.value.domains.map((domain, i) => [domain, props.errors(`selection.domains.${i}`)]),
  ),
)
const update = (field: 'domains' | 'mailboxes', value: string | null | string[]) => {
  draft.value[field] = Array.isArray(value) ? value : value ? [value] : []
}
function addPasted() {
  draft.value.mailboxes = [
    ...new Set([
      ...draft.value.mailboxes,
      ...parseEntryList(pasted.value).map((entry) => entry.value.toLowerCase()),
    ]),
  ]
  pasted.value = ''
}
</script>
<template>
  <div class="space-y-4" data-recipient-selection>
    <p>{{ t('systemSettings.massMail.receivingOnly') }}</p>
    <FormField
      id="mass-scope"
      :label="t('systemSettings.massMail.scope')"
      :errors="errors('selection')"
    >
      <template #default="control"
        ><select v-bind="control" v-model="draft.scope" class="form-control">
          <option value="all">{{ t('systemSettings.massMail.all') }}</option>
          <option value="domains">{{ t('systemSettings.massMail.domains') }}</option>
        </select></template
      >
    </FormField>
    <DomainPicker
      v-if="draft.scope === 'domains'"
      id="mass-domains"
      :label="t('systemSettings.massMail.domains')"
      :sources="[source]"
      :model-value="draft.domains"
      multiple
      :errors="errors('selection.domains')"
      :item-errors="domainErrors"
      @update:model-value="update('domains', $event)"
    />
    <FormField id="mass-list-mode" :label="lt('admin.include_exclude')">
      <template #default="control"
        ><select v-bind="control" v-model="draft.listMode" class="form-control">
          <option v-for="mode in ['none', 'include', 'exclude']" :key="mode" :value="mode">
            {{ t(`systemSettings.massMail.${mode}`) }}
          </option>
        </select></template
      >
    </FormField>
    <LegacyText
      v-if="draft.scope === 'all' && draft.listMode === 'none'"
      k="admin.include_exclude_info"
      as="p"
    />
    <template v-if="draft.listMode !== 'none'">
      <MailboxSearchPicker
        id="mass-mailboxes"
        :label="draft.listMode === 'include' ? lt('admin.includes') : lt('admin.excludes')"
        :model-value="draft.mailboxes"
        multiple
        :domain="domains"
        :status="['active', 'loginDisabled']"
        :errors="errors(`selection.${draft.listMode}`)"
        :item-errors="mailboxErrors"
        @update:model-value="update('mailboxes', $event)"
      />
      <FormField id="mass-paste" :label="t('systemSettings.massMail.paste')"
        ><template #default="control">
          <textarea
            v-bind="control"
            v-model="pasted"
            inputmode="email"
            rows="2"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            class="form-control"
          /></template
      ></FormField>
      <button
        type="button"
        :disabled="!pasted.trim() || draft.mailboxes.length >= max"
        :class="buttonVariants({ variant: 'outline' })"
        @click="addPasted"
      >
        {{ t('systemSettings.massMail.addAddresses') }}
      </button>
    </template>
  </div>
</template>
