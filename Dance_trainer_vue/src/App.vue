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

/* The document itself must never scroll — every view owns its own scrolling.
   This is not the same problem `dvh` solved on the view sizes, and `dvh` alone
   cannot fix it: on Chrome for Android the *initial containing block* is the
   LARGE viewport, the height with the URL bar retracted, and nothing in CSS
   shrinks it. So even with `body { min-height: 100dvh }` sizing the body to the
   visible 730px, `<html>` stayed the ICB's 780px and the document scrolled by
   exactly the URL bar's height — which is how the topbar could be scrolled off
   screen on every route. `min-height` on a child can't shorten its parent's
   containing block; only clipping the overflow ends it.

   Desktop never showed it because there lvh == dvh, so the slack is zero.

   Height on `html` must be an explicit viewport unit: `100%` would resolve
   against that same large ICB and reintroduce the gap. `100vh` is the fallback
   for browsers without dvh, where the two are equal anyway. */
html {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

body {
  font-family: var(--font-body);
  background: var(--color-bg);
  color: var(--color-ink);
  height: 100%;
  overflow: hidden;
}

/* The flex column every route lays itself out in. It lives here because
   BoardSelectView is a fragment — a topbar plus a <main> — so it has no single
   root of its own to constrain. ToastStack is `position: fixed` and so takes
   itself out of this flow. */
#app {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
