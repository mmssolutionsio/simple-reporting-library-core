<script setup lang="ts">
/**
 * `SrlAriaTabChain` – closed tab cycle: Tab on the last focusable element jumps to the first,
 * Shift+Tab on the first to the last (ported from SRL 1).
 */
import { nextTick, onMounted, onUpdated, ref } from 'vue'

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'

const root = ref<HTMLDivElement>()
let tabs: HTMLElement[] = []

function registerTabs() {
  tabs = root.value ? Array.from(root.value.querySelectorAll<HTMLElement>(FOCUSABLE)) : []
}

onMounted(() => nextTick(registerTabs))
onUpdated(() => nextTick(registerTabs))

function next(event: KeyboardEvent) {
  registerTabs()
  if (!tabs.length) return
  if (document.activeElement === tabs[tabs.length - 1]) {
    event.preventDefault()
    tabs[0]?.focus()
  }
}

function prev(event: KeyboardEvent) {
  registerTabs()
  if (!tabs.length) return
  const index = tabs.indexOf(event.target as HTMLElement)
  if (index === -1) tabs[0]?.focus()
  else if (index === 0) tabs[tabs.length - 1]?.focus()
  else tabs[index - 1]?.focus()
}
</script>

<template>
  <div ref="root" tabindex="-1" @keydown.tab.exact.stop="next" @keydown.shift.tab.stop.prevent="prev">
    <slot />
  </div>
</template>
