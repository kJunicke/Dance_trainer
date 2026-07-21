<script setup lang="ts">
import { useToastStore } from '@/stores/toastStore'

const toastStore = useToastStore()
</script>

<template>
  <!-- role="status" lives on the always-mounted wrapper, not on the toasts: a
       live region has to be in the DOM before its content arrives to be
       announced reliably. It already implies aria-live="polite" and
       aria-atomic="true", so those would be noise. Polite rather than assertive
       even for errors — nothing here is time-critical, the toast holds for ten
       seconds, and interrupting mid-word while the user is typing a card name
       costs more than it buys. -->
  <div class="toast-stack" role="status">
    <TransitionGroup name="toast">
      <div v-for="t in toastStore.toasts" :key="t.id" class="toast" :class="t.variant">
        <div class="toast-text">
          <p class="toast-message">{{ t.message }}</p>
          <p v-if="t.detail" class="toast-detail">{{ t.detail }}</p>
        </div>
        <button class="toast-dismiss" aria-label="Dismiss" @click="toastStore.dismiss(t.id)">
          ✕
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  width: min(360px, calc(100vw - 32px));
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: var(--color-ink);
  color: var(--color-surface-light);
  border-radius: var(--radius-sm);
  /* The variant reads off a left rail rather than a tinted background: the same
     signature the task cards use for status, and it keeps the detail line on a
     surface dark enough to stay legible. */
  border-left: 3px solid var(--color-overdue);
  padding: 10px 6px 10px 11px;
  font-size: 0.9rem;
  box-shadow: var(--shadow-modal);
  pointer-events: auto;
}

.toast.success {
  border-left-color: var(--color-good);
}

.toast-text {
  flex: 1;
  min-width: 0;
}

.toast-detail {
  margin-top: 3px;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.7);
  /* Supabase messages can be long and unbroken; better wrapped than clipped. */
  overflow-wrap: anywhere;
}

.toast-dismiss {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  margin: -4px 0;
  border: none;
  background: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.85rem;
  line-height: 1;
  cursor: pointer;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
