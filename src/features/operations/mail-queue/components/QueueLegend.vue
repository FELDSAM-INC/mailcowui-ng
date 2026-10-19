<script setup lang="ts">
// The Queue Manager's explanation and legend (`templates/queue.twig`, FR-053): `queue.info` with
// its markup, then `queue.legend` and "label | legend" for deliver, unhold and hold, in legacy
// order, always shown.
import LegacyText from '@/shared/components/LegacyText.vue'
</script>

<template>
  <div data-queue-legend class="flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-300">
    <LegacyText k="queue.info" as="p" />
    <LegacyText k="queue.legend" as="p" class="font-semibold" />
    <ul class="list-disc ps-5">
      <li><LegacyText k="queue.deliver_mail" /> | <LegacyText k="queue.deliver_mail_legend" /></li>
      <li><LegacyText k="queue.unhold_mail" /> | <LegacyText k="queue.unhold_mail_legend" /></li>
      <li><LegacyText k="queue.hold_mail" /> | <LegacyText k="queue.hold_mail_legend" /></li>
    </ul>
  </div>
</template>
