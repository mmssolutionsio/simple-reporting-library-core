<script setup lang="ts">
const active = defineModel<string>({ required: true })
defineProps<{ tabs: Array<{ name: string; label: string }> }>()
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
      @click="active = tab.name"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
