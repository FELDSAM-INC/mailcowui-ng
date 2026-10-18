<script setup lang="ts">
// A divider between sign-in methods with its text: UI 001's "or" before the password form, and
// UI 012's classic "or login with" (`login.other_logins`) before single sign-on.
</script>

<template>
  <p
    class="flex items-center gap-3 text-sm text-gray-700 before:h-px before:flex-1 before:bg-gray-200 after:h-px after:flex-1 after:bg-gray-200 dark:text-gray-300 dark:before:bg-gray-700 dark:after:bg-gray-700"
  >
    <slot />
  </p>
</template>
