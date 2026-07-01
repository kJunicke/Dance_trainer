<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-body);
  background: var(--color-aubergine);
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
  outline: 2px solid var(--color-brass);
  outline-offset: 2px;
}
</style>
