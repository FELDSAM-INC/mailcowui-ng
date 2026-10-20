<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import FormField from '@/shared/components/FormField.vue'
import { EyeIcon, EyeOffIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'
defineProps<{
  id: string
  name: string
  label: string
  stored: boolean
  disabled?: boolean
  errors?: readonly string[]
}>()
const model = defineModel<string>({ required: true })
const shown = ref(false)
const { t } = useI18n()
</script>
<template>
  <FormField
    :id="id"
    :label="label"
    :required="!stored"
    :description="stored ? t('account.push.stored') : undefined"
    :errors="errors"
  >
    <template #default="control">
      <div class="flex gap-2">
        <input
          v-bind="control"
          v-model="model"
          :name="name"
          :type="shown ? 'text' : 'password'"
          autocomplete="new-password"
          autocapitalize="none"
          spellcheck="false"
          data-1p-ignore
          data-lpignore="true"
          data-bwignore
          maxlength="30"
          class="form-control min-w-0 flex-1"
          :disabled="disabled"
        />
        <button
          type="button"
          :disabled="disabled"
          :class="buttonVariants({ variant: 'outline' })"
          :aria-label="t('auth.signIn.showPassword')"
          :aria-pressed="shown"
          :aria-controls="id"
          @click="shown = !shown"
        >
          <EyeOffIcon v-if="shown" class="size-4" /><EyeIcon v-else class="size-4" />
        </button>
      </div>
    </template>
  </FormField>
</template>
