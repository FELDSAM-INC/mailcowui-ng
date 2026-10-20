<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Impersonation } from '@/api'
import { actingRequestPending, returnFromActing } from '@/features/acting'
import { toBcp47 } from '@/i18n/locales'
import ProblemMessage from '@/shared/components/ProblemMessage.vue'
import { useSecretRequest } from '@/shared/composables/useSecretRequest'
import { UserCircleIcon } from '@/shared/icons'
import { buttonVariants } from '@/shared/ui/button'
const props = defineProps<{ impersonation: Impersonation }>()
const { t, locale } = useI18n(),
  titleId = useId(),
  expanded = ref(false)
const request = useSecretRequest(returnFromActing)
const target = computed(() => props.impersonation.target)
const title = computed(() =>
  t('acting.banner.title', {
    username: target.value.username,
    role: t(`acting.role.${target.value.role}`),
  }),
)
const split = computed(() =>
  target.value.role === 'mailboxUser' ? target.value.username.lastIndexOf('@') : -1,
)
const when = computed(() => {
  const date = new Date(props.impersonation.startedAt),
    today = new Date()
  return new Intl.DateTimeFormat(
    toBcp47(locale.value),
    date.toDateString() === today.toDateString()
      ? { timeStyle: 'short' }
      : { dateStyle: 'medium', timeStyle: 'short' },
  ).format(date)
})
</script>
<template>
  <section
    :aria-labelledby="titleId"
    data-acting-banner
    class="border-b border-acting-border bg-acting-bg px-4 py-2 text-acting-fg"
  >
    <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1">
      <div class="min-w-0 flex-1 basis-56">
        <h2 :id="titleId" :aria-label="title" class="min-w-0 font-semibold">
          <button
            data-acting-name
            type="button"
            :aria-label="title"
            :aria-expanded="expanded"
            class="flex min-h-11 w-full min-w-0 items-center gap-2 rounded text-start focus-visible:outline-2 focus-visible:outline-current"
            @click="expanded = !expanded"
          >
            <UserCircleIcon class="size-5 shrink-0" />
            <span class="min-w-0 flex-1">
              <span class="block text-sm">{{ t('acting.banner.label') + ' ' }}</span>
              <span v-if="expanded" class="block wrap-anywhere">{{ target.username + ', ' }}</span>
              <span v-else class="flex min-w-0"
                ><span class="min-w-0 truncate text-acting-fg">{{
                  split < 0 ? target.username : target.username.slice(0, split)
                }}</span
                ><span v-if="split >= 0" data-acting-domain class="shrink-0 text-acting-fg">{{
                  target.username.slice(split)
                }}</span
                ><span class="shrink-0">{{ ', ' }}</span></span
              >
              <span class="block text-xs">{{ t(`acting.role.${target.role}`) }}</span>
            </span>
          </button>
        </h2>
        <p class="text-xs wrap-anywhere">
          {{
            t('acting.banner.since', { username: impersonation.impersonator.username, time: when })
          }}
        </p>
      </div>
      <button
        data-acting-return
        type="button"
        :class="
          buttonVariants({
            variant: 'outline',
            class: 'min-h-11 max-w-full whitespace-normal wrap-anywhere',
          })
        "
        :disabled="actingRequestPending"
        @click="request.run()"
      >
        {{ t('acting.return', { username: impersonation.impersonator.username }) }}
      </button>
    </div>
    <ProblemMessage
      class="mx-auto mt-2 max-w-7xl"
      :problem="request.problem.value"
      retry
      @retry="request.run()"
    />
  </section>
</template>
