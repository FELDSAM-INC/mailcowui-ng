<script setup lang="ts">
// The API's QR code (UI 005 research R10, FR-113): the allowlisted tree of `qr-svg.ts` rendered by
// Vue's render function inside a white padded box (readable in both themes), with `role="img"` and
// a label pointing to the key shown as text. When the SVG cannot be shown safely, a note points to
// "Open in authenticator app" and the key; enrolment still works.
import { computed, h, type VNode } from 'vue'
import { useI18n } from 'vue-i18n'

import { parseQrDataUri, type QrNode } from '../../qr-svg'

const props = defineProps<{ dataUri: string }>()
const { t } = useI18n()
const tree = computed(() => parseQrDataUri(props.dataUri))

function render(node: QrNode): VNode {
  const attrs =
    node.tag === 'svg'
      ? { ...node.attrs, xmlns: 'http://www.w3.org/2000/svg', width: '100%', height: '100%' }
      : node.attrs
  return h(node.tag, attrs, node.children.map(render))
}

const QrTree = () => (tree.value ? render(tree.value) : null)
</script>

<template>
  <div
    v-if="tree"
    role="img"
    :aria-label="t('account.twoFactor.totp.qrAlt')"
    data-qr-code
    class="size-48 shrink-0 rounded-xl bg-white p-3 sm:size-56"
  >
    <QrTree />
  </div>
  <p v-else data-qr-fallback class="text-sm text-gray-700 dark:text-gray-300">
    {{ t('account.twoFactor.totp.qrUnavailable') }}
  </p>
</template>
