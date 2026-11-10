<script setup lang="ts">
// SRL tab in the Nuxt DevTools (dev only): viewport, grid, spacer, colors and typography of
// srl.config. The grid overlay and the viewport badge on the page are switched here. Plain
// components and CSS (ui/), the theme follows the Nuxt DevTools.
import { computed, ref } from 'vue'
import { useNuxtDevtoolsClient } from './devtoolsClient'
import { settings } from '../shared'
import { useViewPort } from '../state'
import Switch from '../ui/Switch.vue'
import Tabs from '../ui/Tabs.vue'
import DialogColors from '../dialog/Colors.vue'
import DialogGrid from '../dialog/Grid.vue'
import DialogSettings from '../dialog/Settings.vue'
import DialogSpacer from '../dialog/Spacer.vue'
import DialogTypography from '../dialog/Typography.vue'
import DialogViewPort from '../dialog/ViewPort.vue'
import '../ui/styles.css'

const tabs = [
  { name: 'viewport', label: 'Viewport' },
  { name: 'grid', label: 'Grid' },
  { name: 'spacer', label: 'Spacer' },
  { name: 'colors', label: 'Colors' },
  { name: 'typo', label: 'Typography' },
  { name: 'settings', label: 'Settings' },
]
const active = ref('viewport')
const viewPort = useViewPort()
const client = useNuxtDevtoolsClient()

const dark = computed(() => {
  if (settings.value.theme !== 'auto') return settings.value.theme === 'dark'
  const mode = client.value?.devtools?.colorMode
  if (mode) return mode === 'dark'
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
})
</script>

<template>
  <div class="srl-dt" :class="{ 'is-dark': dark }">
    <!-- sticky: bar and tabs stay at the top of the panel while the content scrolls -->
    <header class="srl-dt-head">
      <div class="srl-dt-bar">
        <div class="srl-dt-row">
          <Switch v-model="settings.grid" label="Grid overlay" />
          <input
            v-model.number="settings.gridOpacity"
            type="range"
            min="0.02"
            max="0.3"
            step="0.02"
            :disabled="!settings.grid"
            aria-label="Grid opacity"
          />
        </div>
        <span class="srl-dt-muted">{{ viewPort.viewPort ?? '–' }} · {{ viewPort.innerWidth }}px</span>
      </div>
      <Tabs v-model="active" :tabs="tabs" />
    </header>
    <DialogViewPort v-if="active === 'viewport'" />
    <DialogGrid v-else-if="active === 'grid'" />
    <DialogSpacer v-else-if="active === 'spacer'" />
    <DialogColors v-else-if="active === 'colors'" />
    <DialogTypography v-else-if="active === 'typo'" />
    <DialogSettings v-else />
  </div>
</template>

<style>
html,
body {
  margin: 0;
}
</style>
