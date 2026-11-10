<script setup lang="ts">
// Viewport badge on the page: click toggles the grid, drag moves it, right-click (long press on
// touch) copies the current breakpoint to the clipboard. Like the Nuxt DevTools button it snaps
// to the nearest edge of the window on release; edge and position are stored.
import { computed, onBeforeUnmount, ref } from 'vue'
import { settings } from '../shared'
import { useViewPort } from '../state'

const viewPort = useViewPort()
const el = ref<HTMLButtonElement>()
/** Free position (px, top-left of the badge) while dragging. */
const dragging = ref<{ x: number; y: number } | null>(null)
const MARGIN = 4
const CLICK_DISTANCE = 4

let start: { x: number; y: number; left: number; top: number } | null = null
let moved = false

/** Breakpoint just copied (shown for a moment with a small animation), null otherwise. */
const copied = ref<string | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
/** A long press on touch fires `contextmenu` before the pointer is released: no grid toggle then. */
let suppressClick = false

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    // no Clipboard API (insecure origin, e.g. a LAN IP) or no permission: old fallback below
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
  document.body.append(area)
  area.select()
  document.execCommand('copy')
  area.remove()
}

async function onContextMenu() {
  suppressClick = true
  const name = viewPort.value.viewPort
  if (!name) return
  await writeClipboard(name)
  copied.value = null
  clearTimeout(copiedTimer)
  // next frame, so a repeated right-click restarts the animation
  requestAnimationFrame(() => {
    copied.value = name
    copiedTimer = setTimeout(() => (copied.value = null), 1200)
  })
}

onBeforeUnmount(() => clearTimeout(copiedTimer))

const style = computed<Record<string, string>>(() => {
  if (dragging.value) return { left: `${dragging.value.x}px`, top: `${dragging.value.y}px` }
  const offset = Math.min(100, Math.max(0, settings.value.badgeOffset))
  switch (settings.value.badgeSide) {
    case 'top':
      return { top: `${MARGIN}px`, left: `${offset}%`, transform: `translateX(-${offset}%)` }
    case 'left':
      return { left: `${MARGIN}px`, top: `${offset}%`, transform: `translateY(-${offset}%)` }
    case 'right':
      return { right: `${MARGIN}px`, top: `${offset}%`, transform: `translateY(-${offset}%)` }
    default:
      return { bottom: `${MARGIN}px`, left: `${offset}%`, transform: `translateX(-${offset}%)` }
  }
})

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 || !el.value) return
  const rect = el.value.getBoundingClientRect()
  start = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }
  moved = false
  suppressClick = false
  el.value.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!start || !el.value) return
  const dx = event.clientX - start.x
  const dy = event.clientY - start.y
  if (!moved && Math.hypot(dx, dy) < CLICK_DISTANCE) return
  moved = true
  const { width, height } = el.value.getBoundingClientRect()
  dragging.value = {
    x: Math.min(window.innerWidth - width, Math.max(0, start.left + dx)),
    y: Math.min(window.innerHeight - height, Math.max(0, start.top + dy)),
  }
}

function onPointerUp() {
  if (!start || !el.value) return
  start = null
  if (!moved) {
    if (!suppressClick) settings.value.grid = !settings.value.grid
    suppressClick = false
    return
  }
  // snap to the nearest edge, keep the position along it
  const rect = el.value.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const distances = {
    left: centerX,
    right: window.innerWidth - centerX,
    top: centerY,
    bottom: window.innerHeight - centerY,
  }
  const side = (Object.keys(distances) as Array<keyof typeof distances>).reduce((a, b) => (distances[a] <= distances[b] ? a : b))
  const along =
    side === 'top' || side === 'bottom'
      ? (rect.left / Math.max(1, window.innerWidth - rect.width)) * 100
      : (rect.top / Math.max(1, window.innerHeight - rect.height)) * 100
  settings.value.badgeSide = side
  settings.value.badgeOffset = Math.round(Math.min(100, Math.max(0, along)) * 10) / 10
  dragging.value = null
}
</script>

<template>
  <button
    ref="el"
    type="button"
    class="srl-devtools-badge"
    :class="{ 'is-on': settings.grid, 'is-dragging': dragging, 'is-copied': copied }"
    :style="style"
    :title="`SRL: ${settings.grid ? 'hide' : 'show'} grid · right-click: copy breakpoint · drag to move`"
    @contextmenu.prevent="onContextMenu"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <span class="srl-devtools-badge__dot" aria-hidden="true" />
    <template v-if="copied">
      <span class="srl-devtools-badge__copied">✓ {{ copied }} copied</span>
    </template>
    <template v-else>{{ viewPort.viewPort ?? '–' }} · {{ viewPort.innerWidth }}px</template>
    <span class="srl-devtools-badge__sr" aria-live="polite">{{ copied ? `Breakpoint ${copied} copied` : '' }}</span>
  </button>
</template>
