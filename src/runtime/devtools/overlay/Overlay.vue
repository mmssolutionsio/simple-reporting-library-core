<script setup lang="ts">
// On the page (dev only): grid columns and a badge with breakpoint and width. Switched in the SRL
// tab of the Nuxt DevTools; a click on the badge toggles the grid, dragging moves it, a right-click
// copies the breakpoint. The grid is built
// from srl.config (columns, gutter, containers of the current breakpoint), plain CSS: core is
// packaged without the project's `srl` SCSS module.
import { computed } from 'vue'
import { settings } from '../shared'
import { useSrlConfig, useViewPort } from '../state'
import Badge from './Badge.vue'

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
  <Badge v-if="settings.badge" />
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
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  padding: 2px 7px;
  border: 0;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font: 11px/1.4 system-ui, sans-serif;
  cursor: pointer;
  touch-action: none;
  user-select: none;
  white-space: nowrap;
}
.srl-devtools-badge.is-dragging {
  cursor: grabbing;
  opacity: 0.85;
}
.srl-devtools-badge__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #9ca3af;
}
.srl-devtools-badge.is-on .srl-devtools-badge__dot {
  background: #00dc82;
}
/* right-click copied the breakpoint: short pop + green flash. `scale` (not `transform`), so the
   transform that positions the badge on its edge stays untouched. */
.srl-devtools-badge.is-copied {
  animation: srl-devtools-badge-copied 1.2s ease-out;
}
.srl-devtools-badge.is-copied .srl-devtools-badge__dot {
  background: #00dc82;
  animation: srl-devtools-badge-dot 0.6s ease-out;
}
.srl-devtools-badge__copied {
  animation: srl-devtools-badge-text 0.25s ease-out;
}
.srl-devtools-badge__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
@keyframes srl-devtools-badge-copied {
  0% {
    scale: 1;
    background: rgba(0, 0, 0, 0.7);
  }
  15% {
    scale: 1.15;
    background: rgba(4, 122, 75, 0.95);
  }
  35% {
    scale: 1;
  }
  75% {
    background: rgba(4, 122, 75, 0.95);
  }
  100% {
    background: rgba(0, 0, 0, 0.7);
  }
}
@keyframes srl-devtools-badge-dot {
  0% {
    box-shadow: 0 0 0 0 rgba(0, 220, 130, 0.9);
  }
  100% {
    box-shadow: 0 0 0 8px rgba(0, 220, 130, 0);
  }
}
@keyframes srl-devtools-badge-text {
  from {
    opacity: 0;
    translate: 0 3px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .srl-devtools-badge.is-copied,
  .srl-devtools-badge.is-copied .srl-devtools-badge__dot,
  .srl-devtools-badge__copied {
    animation: none;
  }
  .srl-devtools-badge.is-copied {
    background: rgba(4, 122, 75, 0.95);
  }
}
</style>
