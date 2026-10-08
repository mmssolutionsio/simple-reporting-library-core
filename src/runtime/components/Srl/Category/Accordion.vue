<script setup lang="ts">
/**
 * `SrlCategoryAccordion` – provides `accordion` ({ id, state, toggle, open, close }) to its
 * slot (used with SrlCategoryAccordionToggle/Content). Opens for a matching URL hash.
 */
import { useRoute } from '#imports'
import { computed, nextTick, onMounted, ref, useId } from 'vue'
import { useSrlAccordionAnchored } from '../../../composables/pageState'

const root = ref<HTMLElement | null>(null)
const id = useId()
const state = ref(false)
const route = useRoute()
const anchored = useSrlAccordionAnchored()

function open() {
  state.value = true
  nextTick(() => root.value?.querySelector<HTMLElement>(`[id="${id}"]`)?.focus({ preventScroll: true }))
}

function close() {
  state.value = false
  root.value?.querySelector<HTMLElement>(`[aria-controls="${id}"]`)?.focus()
}

function toggle() {
  if (state.value) close()
  else open()
}

const accordion = computed(() => ({ id, state: state.value, toggle, open, close }))

onMounted(() => {
  const r = root.value
  const target = decodeURIComponent(route.hash.slice(1))
  if (!r || !target) return
  const matches = r.id === target || !!r.querySelector(`[id="${CSS.escape(target)}"]`)
  if (!matches) return
  open()
  if (!anchored.value) {
    anchored.value = true
    nextTick(() => setTimeout(() => r.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200))
  }
})
</script>

<template>
  <div ref="root" tabindex="-1">
    <slot :accordion="accordion" />
  </div>
</template>
