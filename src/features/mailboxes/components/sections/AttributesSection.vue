<script setup lang="ts">
// The "Custom attributes" tab of the classic mailbox page (#mattr) as one section: a table of
// attribute and value rows with "Remove row", "Add row" and the save (`admin.save`). Changes are
// sent per name: added and changed names with their value, removed and renamed names as removals
// (FR-039). Names without whitespace, unique; the limits come from the capabilities.
import { computed, ref } from 'vue'

import { lt } from '@/i18n'
import EditableSection from '@/shared/components/EditableSection.vue'
import ErrorSummary from '@/shared/components/ErrorSummary.vue'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { buttonVariants } from '@/shared/ui/button'
import type { ClientErrors } from '@/shared/validation/client-errors'

import { useMailboxSection, type MailboxSectionProps } from '../../composables/useMailboxSection'
import { attributesPatch } from '../../patch'
import type { Mailbox } from '../../types'
import { checkAttributes, type AttributeRow } from '../../validation'

const props = withDefaults(defineProps<MailboxSectionProps>(), {
  editing: false,
  editDisabledReason: null,
  capabilities: undefined,
  identity: null,
})
const emit = defineEmits<{
  edit: []
  close: []
  dirty: [value: boolean]
  saved: [mailbox: Mailbox]
}>()

let nextId = 1
const toForm = (mailbox: Mailbox): AttributeRow[] =>
  Object.entries(mailbox.customAttributes).map(([name, value]) => ({
    id: nextId++,
    name,
    value,
    storedName: name,
  }))

function validate(rows: AttributeRow[], base: Mailbox): ClientErrors {
  const errors: ClientErrors = {}
  checkAttributes(errors, rows, props.capabilities, base.customAttributes)
  return errors
}

let currentRows: () => AttributeRow[] = () => []

const s = useMailboxSection<AttributeRow[]>(props, emit as never, {
  id: 'attributes',
  fields: ['customAttributes'],
  toForm: (mailbox) => toForm(mailbox).map((row, index) => ({ ...row, id: index + 1 })),
  validate,
  fieldId: (path): string | null => {
    const [, id, part] = path.split('.')
    if (path.startsWith('attributes.') && id) return `section-attributes-${id}-${part ?? 'name'}`
    if (path.startsWith('customAttributes.')) {
      const name = path.slice('customAttributes.'.length)
      const row = currentRows().find((item) => item.name === name)
      return row ? `section-attributes-${row.id}-name` : 'section-attributes-add'
    }
    return 'section-attributes-add'
  },
  makePatch: (opened, rows) => {
    const patch = attributesPatch(opened.customAttributes, rows)
    return patch ? { customAttributes: patch } : {}
  },
})

currentRows = () => s.form.value

const added = ref(0)
function addRow() {
  const id = Math.max(0, ...s.form.value.map((row) => row.id)) + 1
  s.form.value = [...s.form.value, { id, name: '', value: '' }]
  added.value = id
}
function removeRow(id: number) {
  s.form.value = s.form.value.filter((row) => row.id !== id)
}
const stored = computed(() => Object.entries(props.mailbox.customAttributes))
const CELL = 'form-control'
</script>

<template>
  <EditableSection
    section-id="attributes"
    :title="lt('edit.custom_attributes')"
    :editable="true"
    :editing="editing"
    :edit-disabled-reason="editDisabledReason"
    :saving="s.pending.value"
    :status="s.status.value"
    :outdated="s.outdated.value"
    :save-label="lt('admin.save')"
    @edit="emit('edit')"
    @cancel="s.cancel"
    @save="s.save"
    @save-again="s.saveAgain"
    @discard="s.discard"
  >
    <div v-if="stored.length > 0" class="table-frame">
      <table class="data-table w-full table-fixed text-sm">
        <thead>
          <tr class="text-start">
            <th scope="col" class="w-2/5 pb-2 text-start">
              {{ lt('user.attribute') }}
            </th>
            <th scope="col" class="pb-2 text-start">{{ lt('user.value') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="[name, value] in stored" :key="name" class="align-top">
            <td class="py-1 pe-3 break-words text-gray-900 dark:text-white">{{ name }}</td>
            <td class="py-1 break-words text-gray-900 dark:text-white">{{ value }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="text-sm text-gray-700 dark:text-gray-300">{{ lt('user.no_record') }}</p>
    <template #form>
      <ErrorSummary :id="s.problemForm.summaryId" :items="s.problemForm.summary.value" />
      <ProblemMessage :problem="s.problem.value" />
      <p
        v-for="message in s.errorsFor('attributes')"
        :key="message"
        role="alert"
        class="text-sm text-red-700 dark:text-red-300"
      >
        {{ message }}
      </p>
      <div class="flex flex-col gap-3">
        <div
          class="hidden grid-cols-[2fr_3fr_auto] gap-2 text-sm text-gray-600 sm:grid dark:text-gray-400"
        >
          <span>{{ lt('user.attribute') }}</span>
          <span>{{ lt('user.value') }}</span>
          <span class="sr-only">{{ lt('admin.remove_row') }}</span>
        </div>
        <div
          v-for="(row, index) in s.form.value"
          :key="row.id"
          data-attribute-row
          class="grid grid-cols-1 gap-2 border-b border-gray-200 pb-3 sm:grid-cols-[2fr_3fr_auto] sm:border-0 sm:pb-0 dark:border-gray-800"
        >
          <div class="flex min-w-0 flex-col gap-1">
            <label
              :for="`section-attributes-${row.id}-name`"
              class="text-sm text-gray-700 sm:sr-only dark:text-gray-300"
            >
              {{ `${lt('user.attribute')} ${index + 1}` }}
            </label>
            <input
              :id="`section-attributes-${row.id}-name`"
              v-model="row.name"
              type="text"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              :aria-invalid="
                s.errorsFor(`attributes.${row.id}.name`).length > 0 ? 'true' : undefined
              "
              :aria-describedby="
                s.errorsFor(`attributes.${row.id}.name`).length > 0
                  ? `section-attributes-${row.id}-name-error`
                  : undefined
              "
              :class="CELL"
            />
            <p
              v-if="s.errorsFor(`attributes.${row.id}.name`).length > 0"
              :id="`section-attributes-${row.id}-name-error`"
              class="text-sm text-red-700 dark:text-red-300"
            >
              {{ s.errorsFor(`attributes.${row.id}.name`).join(' ') }}
            </p>
          </div>
          <div class="flex min-w-0 flex-col gap-1">
            <label
              :for="`section-attributes-${row.id}-value`"
              class="text-sm text-gray-700 sm:sr-only dark:text-gray-300"
            >
              {{ `${lt('user.value')} ${index + 1}` }}
            </label>
            <input
              :id="`section-attributes-${row.id}-value`"
              v-model="row.value"
              type="text"
              autocomplete="off"
              :aria-invalid="
                s.errorsFor(`attributes.${row.id}.value`).length > 0 ? 'true' : undefined
              "
              :aria-describedby="
                s.errorsFor(`attributes.${row.id}.value`).length > 0
                  ? `section-attributes-${row.id}-value-error`
                  : undefined
              "
              :class="CELL"
            />
            <p
              v-if="s.errorsFor(`attributes.${row.id}.value`).length > 0"
              :id="`section-attributes-${row.id}-value-error`"
              class="text-sm text-red-700 dark:text-red-300"
            >
              {{ s.errorsFor(`attributes.${row.id}.value`).join(' ') }}
            </p>
          </div>
          <button
            type="button"
            :class="buttonVariants({ variant: 'outline' })"
            :aria-label="`${lt('admin.remove_row')} ${index + 1}`"
            @click="removeRow(row.id)"
          >
            {{ lt('admin.remove_row') }}
          </button>
        </div>
      </div>
      <button
        id="section-attributes-add"
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        class="self-start"
        @click="addRow"
      >
        {{ lt('admin.add_row') }}
      </button>
    </template>
  </EditableSection>
</template>
