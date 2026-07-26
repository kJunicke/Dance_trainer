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
  /* dvh, not vh. `vh` is the *large* viewport — measured with the browser chrome
     retracted — so on a phone with the chrome showing, a 100vh body is taller
     than the visible area by exactly the chrome height. The whole page then
     scrolls, carrying BoardView's topbar off the top and the bottom of the
     practice queue below the fold, even though `.board-view` is 100dvh and fits.
     The vh line is the fallback for browsers without dvh. */
  min-height: 100vh;
  min-height: 100dvh;
}

button,
input,
textarea,
select {
  font-family: inherit;
}

/* The app's only focus indicator, so it has to clear the 3:1 non-text floor on
   every surface it can land on. Plain ember is 2.51 on the board background;
   --color-ember-text is 4.53 there and 5.95 on a white card. */
:focus-visible {
  outline: 2px solid var(--color-ember-text);
  outline-offset: 2px;
}

/* Same single indicator, re-toned for the one surface whose ground is dark
   enough to swallow it. Kept here rather than in the practice components so
   there is still exactly one place that decides what focus looks like. */
.practice-view :focus-visible {
  outline-color: var(--pc-focus);
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
