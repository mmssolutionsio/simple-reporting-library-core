<script setup lang="ts">
// SRL tab in the Nuxt DevTools (dev only): viewport, grid, spacer, colors and typography of
// srl.config. The grid overlay and the viewport badge on the page are switched here.
import { computed } from 'vue'
import { NConfigProvider, NFlex, NLayout, NSlider, NSwitch, NTabPane, NTabs, NText, darkTheme } from 'naive-ui'
import { settings } from '../shared'
import { useViewPort } from '../state'
import Content from '../components/Content.vue'
import DialogColors from '../dialog/Colors.vue'
import DialogGrid from '../dialog/Grid.vue'
import DialogSettings from '../dialog/Settings.vue'
import DialogSpacer from '../dialog/Spacer.vue'
import DialogTypography from '../dialog/Typography.vue'
import DialogViewPort from '../dialog/ViewPort.vue'

const viewPort = useViewPort()
const theme = computed(() => (settings.value.darkMode ? darkTheme : null))
</script>

<template>
  <NConfigProvider :theme="theme">
    <NLayout class="srl-devtools-tab">
      <NFlex align="center" justify="space-between" class="srl-devtools-tab__bar">
        <NFlex align="center">
          <NText strong>Grid overlay</NText>
          <NSwitch v-model:value="settings.grid" size="small" />
          <NSlider
            v-model:value="settings.gridOpacity"
            :min="0.02"
            :max="0.3"
            :step="0.02"
            :disabled="!settings.grid"
            style="width: 120px"
          />
        </NFlex>
        <NText depth="3">{{ viewPort.viewPort ?? '–' }} · {{ viewPort.innerWidth }}px</NText>
      </NFlex>
      <NTabs type="line" animated size="small">
        <NTabPane name="viewport" tab="Viewport"><Content><DialogViewPort /></Content></NTabPane>
        <NTabPane name="grid" tab="Grid"><Content><DialogGrid /></Content></NTabPane>
        <NTabPane name="spacer" tab="Spacer"><Content><DialogSpacer /></Content></NTabPane>
        <NTabPane name="colors" tab="Colors"><Content><DialogColors /></Content></NTabPane>
        <NTabPane name="typo" tab="Typography"><Content><DialogTypography /></Content></NTabPane>
        <NTabPane name="settings" tab="Settings"><Content><DialogSettings /></Content></NTabPane>
      </NTabs>
    </NLayout>
  </NConfigProvider>
</template>

<style>
html,
body {
  margin: 0;
}
.srl-devtools-tab {
  min-height: 100vh;
  padding: 8px 16px 24px;
  box-sizing: border-box;
  font-family: system-ui, sans-serif;
  font-size: 13px;
}
.srl-devtools-tab__bar {
  padding-block: 4px 8px;
}
</style>
