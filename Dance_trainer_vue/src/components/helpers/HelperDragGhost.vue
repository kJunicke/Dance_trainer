<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const EDGE_GAP = 8

const props = defineProps<{
  x: number
  y: number
  label: string
}>()

const el = ref<HTMLElement | null>(null)
const size = ref({ width: 0, height: 0 })

onMounted(() => {
  if (el.value) size.value = { width: el.value.offsetWidth, height: el.value.offsetHeight }
})

function inside(value: number, length: number, room: number): number {
  return Math.max(EDGE_GAP, Math.min(value, room - length - EDGE_GAP))
}

// Up and to the left of the finger, so the finger doesn't cover what it's carrying.
const position = computed(() => {
  const { clientWidth, clientHeight } = document.documentElement
  const { width, height } = size.value
  return {
    left: `${inside(props.x - width * 0.9, width, clientWidth)}px`,
    top: `${inside(props.y - height * 1.3, height, clientHeight)}px`,
  }
})
</script>

<template>
  <div ref="el" class="hp-ghost" :style="position">{{ label }}</div>
</template>
