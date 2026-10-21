<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AppLinkSettingsEntry } from '@/api'
import { lt } from '@/i18n'
import { announce } from '@/shared/composables/useAnnouncer'
import { buttonVariants } from '@/shared/ui/button'
import { appLinkPreview, moveAppLink } from '../../lib/app-link-url'
import AppLinkEntryForm from './AppLinkEntryForm.vue'
const props = withDefaults(
  defineProps<{
    modelValue: readonly AppLinkSettingsEntry[]
    username: string
    editable?: boolean
    disabled?: boolean
    errorsFor?: (path: string) => readonly string[]
  }>(),
  { editable: false, disabled: false, errorsFor: () => [] },
)
const emit = defineEmits<{
  'update:modelValue': [value: AppLinkSettingsEntry[]]
  invalidPaste: [path: string]
  input: []
}>()
const { t } = useI18n(),
  root = ref<HTMLElement | null>(null)
function update(index: number, value: AppLinkSettingsEntry) {
  const rows = [...props.modelValue]
  rows[index] = value
  emit('update:modelValue', rows)
  emit('input')
}
async function move(index: number, direction: -1 | 1) {
  if (props.disabled) return
  const target = index + direction
  if (target < 0 || target >= props.modelValue.length) return
  emit('update:modelValue', moveAppLink(props.modelValue, index, direction))
  emit('input')
  announce(
    t('systemSettings.appLinks.moved', {
      name: props.modelValue[index]!.name,
      position: target + 1,
      count: props.modelValue.length,
    }),
  )
  await nextTick()
  const button = root.value?.querySelector<HTMLButtonElement>(
    `[data-move-${direction === -1 ? 'up' : 'down'}="${target}"]`,
  )
  if (button && !button.disabled) button.focus()
  else root.value?.querySelector<HTMLElement>(`#app-link-${target}-name`)?.focus()
}
async function add() {
  if (props.disabled || props.modelValue.length >= 50) return
  emit('update:modelValue', [
    ...props.modelValue,
    { name: '', url: '', signedInUrl: null, showOnLoginPage: true },
  ])
  emit('input')
  await nextTick()
  root.value?.querySelector<HTMLElement>(`#app-link-${props.modelValue.length - 1}-name`)?.focus()
}
async function remove(index: number) {
  if (props.disabled) return
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== index),
  )
  emit('input')
  await nextTick()
  ;(
    root.value?.querySelector<HTMLElement>(
      `#app-link-${Math.min(index, props.modelValue.length - 1)}-name`,
    ) ?? root.value?.querySelector<HTMLElement>('[data-add-link]')
  )?.focus()
}
</script>
<template>
  <div ref="root" class="min-w-0 space-y-4" data-app-link-list>
    <template v-if="editable">
      <fieldset
        v-for="(link, index) in modelValue"
        :key="index"
        class="min-w-0 space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700"
        :data-app-link="index"
      >
        <legend class="max-w-full px-1 wrap-anywhere font-medium">
          {{ t('systemSettings.appLinks.row', { position: index + 1 }) }}
        </legend>
        <AppLinkEntryForm
          :model-value="link"
          :index="index"
          :username="username"
          :disabled="disabled"
          :errors-for="errorsFor"
          @update:model-value="update(index, $event)"
          @invalid-paste="emit('invalidPaste', $event)"
        />
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            :data-move-up="index"
            :class="buttonVariants({ variant: 'outline' })"
            :disabled="disabled || index === 0"
            :aria-label="t('systemSettings.appLinks.moveUpNamed', { name: link.name || index + 1 })"
            @click="move(index, -1)"
          >
            {{ t('systemSettings.appLinks.moveUp') }}
          </button>
          <button
            type="button"
            :data-move-down="index"
            :class="buttonVariants({ variant: 'outline' })"
            :disabled="disabled || index === modelValue.length - 1"
            :aria-label="
              t('systemSettings.appLinks.moveDownNamed', { name: link.name || index + 1 })
            "
            @click="move(index, 1)"
          >
            {{ t('systemSettings.appLinks.moveDown') }}
          </button>
          <button
            type="button"
            :data-remove="index"
            :class="buttonVariants({ variant: 'outline' })"
            :disabled="disabled"
            :aria-label="`${lt('admin.remove_row')}: ${link.name || index + 1}`"
            @click="remove(index)"
          >
            {{ lt('admin.remove_row') }}
          </button>
        </div>
      </fieldset>
      <button
        type="button"
        data-add-link
        :class="buttonVariants({ variant: 'outline' })"
        :disabled="disabled || modelValue.length >= 50"
        aria-describedby="app-link-limit"
        @click="add"
      >
        {{ lt('admin.add_row') }}
      </button>
      <p id="app-link-limit" class="text-sm">
        {{ t('systemSettings.appLinks.limit', { count: modelValue.length }) }}
      </p>
    </template>
    <template v-else>
      <p v-if="!modelValue.length">{{ t('systemSettings.appLinks.empty') }}</p>
      <template v-else>
        <div class="space-y-3 md:hidden" data-link-cards>
          <dl
            v-for="(link, index) in modelValue"
            :key="index"
            class="min-w-0 space-y-2 rounded-xl border border-gray-200 p-3 wrap-anywhere dark:border-gray-700"
          >
            <div>
              <dt class="font-medium">{{ lt('admin.app_name') }}</dt>
              <dd>{{ link.name }}</dd>
            </div>
            <div>
              <dt class="font-medium">{{ lt('admin.link') }}</dt>
              <dd>{{ link.url }}</dd>
            </div>
            <div>
              <dt class="font-medium">{{ lt('admin.user_link') }}</dt>
              <dd>{{ link.signedInUrl || t('systemSettings.appLinks.sameAsLinkValue') }}</dd>
            </div>
            <div>
              <dt class="font-medium">{{ lt('admin.app_hide') }}</dt>
              <dd>{{ t(link.showOnLoginPage ? 'lists.filters.no' : 'lists.filters.yes') }}</dd>
            </div>
            <div>
              <dt class="font-medium">{{ t('systemSettings.appLinks.preview', { username }) }}</dt>
              <dd>
                {{ appLinkPreview(link, username) ?? t('systemSettings.appLinks.previewInvalid') }}
              </dd>
            </div>
          </dl>
        </div>
        <div class="table-frame hidden md:block">
          <table
            class="data-table w-full table-fixed border-collapse text-left text-sm"
            data-link-table
          >
            <caption class="sr-only">
              {{
                lt('admin.app_links')
              }}
            </caption>
            <thead>
              <tr>
                <th
                  v-for="label in [
                    'admin.app_name',
                    'admin.link',
                    'admin.user_link',
                    'admin.app_hide',
                  ]"
                  :key="label"
                  scope="col"
                  class="p-2 align-top wrap-anywhere"
                >
                  {{ lt(label) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(link, index) in modelValue"
                :key="index"
                class="border-t border-gray-200 dark:border-gray-700"
              >
                <th scope="row" class="p-2 align-top wrap-anywhere font-normal">{{ link.name }}</th>
                <td class="p-2 align-top wrap-anywhere">{{ link.url }}</td>
                <td class="p-2 align-top wrap-anywhere">
                  <p>{{ link.signedInUrl || t('systemSettings.appLinks.sameAsLinkValue') }}</p>
                  <p class="mt-2 text-xs">
                    {{ t('systemSettings.appLinks.preview', { username }) }}
                    {{
                      appLinkPreview(link, username) ?? t('systemSettings.appLinks.previewInvalid')
                    }}
                  </p>
                </td>
                <td class="p-2 align-top">
                  {{ t(link.showOnLoginPage ? 'lists.filters.no' : 'lists.filters.yes') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </div>
</template>
