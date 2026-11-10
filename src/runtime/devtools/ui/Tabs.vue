<script setup lang="ts">
const active = defineModel<string>({ required: true })
defineProps<{ tabs: Array<{ name: string; label: string }> }>()

/** On narrow panels the tab row scrolls sideways: bring the chosen tab fully into view. */
function onClick(name: string, event: MouseEvent) {
  active.value = name
  ;(event.currentTarget as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
}
</script>

<template>
  <div class="srl-dt-tabs" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.name"
      type="button"
      role="tab"
      class="srl-dt-tabs__tab"
      :class="{ 'is-active': active === tab.name }"
      :aria-selected="active === tab.name"
      @click="onClick(tab.name, $event)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
