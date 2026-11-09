<script setup lang="ts">
const model = defineModel<boolean>({ default: false })
defineProps<{ label?: string }>()
</script>

<template>
  <label class="srl-dt-switch">
    <input v-model="model" type="checkbox" role="switch" />
    <span class="srl-dt-switch__track" aria-hidden="true"><span class="srl-dt-switch__thumb" /></span>
    <span v-if="label">{{ label }}</span>
  </label>
</template>
