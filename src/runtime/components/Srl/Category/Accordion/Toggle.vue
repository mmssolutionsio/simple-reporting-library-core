<script setup lang="ts">
import { computed } from 'vue'

export interface SrlCategoryAccordionState {
  id: string
  state: boolean
  toggle: () => void
  open: () => void
  close: () => void
}

const props = withDefaults(defineProps<{ accordion: SrlCategoryAccordionState; level?: number | string }>(), {
  level: 1,
})

const headingLevel = computed(() => Math.min(Math.max(Number(props.level) + 2, 2), 6))
</script>

<template>
  <component :is="`h${headingLevel}`" :class="`srl-title-h${headingLevel}`">
    <button
      type="button"
      class="srl-category-accordion__head--btn"
      :aria-expanded="accordion.state"
      :aria-controls="accordion.id"
      @click="accordion.toggle()"
    >
      <slot />
    </button>
  </component>
</template>
