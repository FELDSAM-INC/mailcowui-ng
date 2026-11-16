<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import FormField from '@/shared/components/FormField.vue'
import { buttonVariants } from '@/shared/ui/button'
const text = defineModel<string>({ required: true })
const props = defineProps<{
  id: string
  rules: Record<string, boolean | string>
  readonly: boolean
  errors: readonly string[]
}>()
const { t } = useI18n()
type Pair = { o: string; v: string }
const pairs = computed<Pair[] | null>(() => {
  const raw = text.value.trim()
  if (!raw) return []
  try {
    if (raw.startsWith('[')) {
      const data: unknown = JSON.parse(raw)
      return Array.isArray(data) &&
        data.every(
          (v: unknown) =>
            typeof v === 'object' &&
            v !== null &&
            'o' in v &&
            'v' in v &&
            typeof v.o === 'string' &&
            typeof v.v === 'string',
        )
        ? (data as Pair[])
        : null
    }
    const result: Pair[] = []
    for (const item of raw.split(/\s+(?=--)/)) {
      const match = /^--([a-z][a-z0-9]*)(?:=(.*))?$/is.exec(item)
      if (!match) return null
      result.push({ o: match[1]!.toLowerCase(), v: match[2] ?? '' })
    }
    return result
  } catch {
    return null
  }
})
const names = computed(() => Object.keys(props.rules).sort())
function change(index: number, key: 'o' | 'v', value: string) {
  const list = structuredClone(pairs.value ?? [])
  const pair = list[index]
  if (!pair) return
  pair[key] = value
  if (key === 'o' && props.rules[value] === false) pair.v = ''
  text.value = JSON.stringify(list)
}
function add() {
  text.value = JSON.stringify([...(pairs.value ?? []), { o: names.value[0] ?? '', v: '' }])
}
function remove(index: number) {
  const list = pairs.value?.filter((_, i) => i !== index) ?? []
  text.value = list.length ? JSON.stringify(list) : ''
}
</script>
<template>
  <FormField
    :id="id"
    :label="t('syncSources.options')"
    :errors="errors"
    :description="t('syncSources.optionsHelp')"
    ><div v-if="pairs !== null" :id="id" class="space-y-3">
      <div v-for="(pair, index) in pairs" :key="index" class="flex flex-wrap items-center gap-2">
        <select
          :aria-label="t('syncSources.option')"
          :value="pair.o"
          :disabled="readonly"
          class="form-control min-w-40 flex-1"
          @change="change(index, 'o', ($event.target as HTMLSelectElement).value)"
        >
          <option v-if="!names.includes(pair.o)" :value="pair.o">{{ pair.o }}</option>
          <option v-for="name in names" :key="name" :value="name">--{{ name }}</option></select
        ><input
          v-if="rules[pair.o] !== false"
          :aria-label="t('syncSources.optionValue')"
          :value="pair.v"
          :readonly="readonly"
          maxlength="1000"
          class="form-control min-w-40 flex-1"
          @input="change(index, 'v', ($event.target as HTMLInputElement).value)"
        /><button
          v-if="!readonly"
          type="button"
          :class="buttonVariants({ variant: 'outline', size: 'sm' })"
          @click="remove(index)"
        >
          {{ t('syncSources.removeOption') }}
        </button>
      </div>
      <button
        v-if="!readonly"
        type="button"
        :class="buttonVariants({ variant: 'outline' })"
        :disabled="pairs.length >= 100"
        @click="add"
      >
        {{ t('syncSources.addOption') }}
      </button>
    </div>
    <template v-else
      ><p class="mb-2 text-sm text-warning">{{ t('syncSources.migrationWarning') }}</p>
      <textarea
        :id="id"
        v-model="text"
        :readonly="readonly"
        class="form-control font-mono"
        rows="3"
      /></template
  ></FormField>
</template>
