<script setup lang="ts">
/** Content of SrlCategoryAccordion; focusable children leave the tab order while closed. */
import { onMounted, ref, watch } from 'vue'
import type { SrlCategoryAccordionState } from './Toggle.vue'

const props = defineProps<{ accordion: SrlCategoryAccordionState }>()

const root = ref<HTMLDivElement | null>(null)
let focusElements: HTMLElement[] = []

function getFocusElements(container: HTMLElement) {
  const elements = container.querySelectorAll<HTMLElement>(
    'a, button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])',
  )
  return Array.from(elements).filter((el) => {
    const hiddenParent = el.closest('[hidden]')
    return !hiddenParent || hiddenParent === container
  })
}

function setTabIndex(value: number) {
  for (const el of focusElements) el.tabIndex = value
}

watch(
  () => props.accordion.state,
  (open) => setTabIndex(open ? 0 : -1),
)

onMounted(() => {
  if (root.value) focusElements = getFocusElements(root.value)
  if (!props.accordion.state) setTabIndex(-1)
})
</script>

<template>
  <div
    :id="accordion.id"
    ref="root"
    :hidden="!accordion.state"
    tabindex="-1"
    @keydown.esc.stop.prevent="accordion.close()"
  >
    <slot />
  </div>
</template>
