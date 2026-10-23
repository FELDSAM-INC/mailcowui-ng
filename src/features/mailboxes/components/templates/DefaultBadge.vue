<script setup lang="ts">
import { Badge } from '@/shared/ui/badge'

// The mark of the Default template, as text (as UI 002's template list has it).
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <Badge data-default-badge color="info">
    {{ t('domainTemplates.default') }}
  </Badge>
</template>
