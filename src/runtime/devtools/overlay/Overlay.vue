<script setup lang="ts">
// On the page (dev only): grid columns and a badge with breakpoint and width. Switched in the SRL
// tab of the Nuxt DevTools. The grid is built from srl.config (columns, gutter, containers of the
// current breakpoint), plain CSS: core is packaged without the project's `srl` SCSS module.
import { computed } from 'vue'
import { settings } from '../shared'
import { useSrlConfig, useViewPort } from '../state'

const srlConfig = useSrlConfig()
const viewPort = useViewPort()

/** srl.config numbers are px. */
const css = (value: unknown): string | undefined =>
  value === undefined || value === null ? undefined : typeof value === 'number' ? `${value}px` : String(value)

const grid = computed(() => {
  const name = viewPort.value.viewPort
  const config = srlConfig.value.grid ?? {}
  const columns = (name && Number(config.columns?.[name])) || 0
  const container = (name && config.containers?.[name]) || {}
  const gutter = (name && config.gutter?.[name]) || {}
  return {
    columns,
    container: {
      maxWidth: css(container['max-width']),
      paddingInline: css(container.padding),
    },
    row: {
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      columnGap: css(gutter.gap ?? gutter['column-gap']) ?? '0px',
    },
  }
})
</script>

<template>
  <div v-if="settings.grid && grid.columns" class="srl-devtools-grid" aria-hidden="true">
    <div class="srl-devtools-grid__container" :style="grid.container">
      <div class="srl-devtools-grid__row" :style="grid.row">
        <div v-for="i in grid.columns" :key="i" :style="{ backgroundColor: `rgba(255, 0, 0, ${settings.gridOpacity})` }" />
      </div>
    </div>
  </div>
  <div v-if="settings.badge" class="srl-devtools-badge" :class="`srl-devtools-badge--${settings.badgePosition}`" aria-hidden="true">
    {{ viewPort.viewPort ?? '–' }} · {{ viewPort.innerWidth }}px
  </div>
</template>

<style>
.srl-devtools-grid {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483000;
  overflow: hidden;
}
.srl-devtools-grid__container {
  box-sizing: border-box;
  height: 100dvh;
  margin-inline: auto;
}
.srl-devtools-grid__row {
  display: grid;
  height: 100%;
}
.srl-devtools-badge {
  position: fixed;
  z-index: 2147483001;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font: 11px/1.4 system-ui, sans-serif;
  pointer-events: none;
}
.srl-devtools-badge--top-right { top: 4px; right: 4px; }
.srl-devtools-badge--top-left { top: 4px; left: 4px; }
.srl-devtools-badge--bottom-right { bottom: 4px; right: 4px; }
.srl-devtools-badge--bottom-left { bottom: 4px; left: 4px; }
</style>
