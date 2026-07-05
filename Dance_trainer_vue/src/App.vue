<script setup lang="ts">
import { RouterView } from 'vue-router'
import ToastStack from '@/components/ToastStack.vue'
</script>

<template>
  <RouterView />
  <ToastStack />
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-body);
  background: var(--color-bg);
  color: var(--color-ink);
  min-height: 100vh;
}

button,
input,
textarea,
select {
  font-family: inherit;
}

:focus-visible {
  outline: 2px solid var(--color-ember);
  outline-offset: 2px;
}

/* iOS Safari zooms the page when a focused input's font is under 16px. */
@media (max-width: 640px) {
  input,
  textarea,
  select {
    font-size: 16px;
  }
}
</style>
