// State shared between the SRL tab (iframe in the Nuxt DevTools) and the overlay on the page.
// Both run on the same origin: settings live in localStorage (the `storage` event syncs the
// other document), the page width goes through a BroadcastChannel.
import { ref, watch } from 'vue'
import type { SrlDevToolsMessage, SrlDevToolsSettings } from './types'

const STORAGE_KEY = 'srl-devtools'
export const CHANNEL_NAME = 'srl-devtools'

export const defaultSettings: SrlDevToolsSettings = {
  grid: false,
  gridOpacity: 0.08,
  badge: true,
  badgePosition: 'bottom-right',
  theme: 'auto',
}

export const badgePositions: SrlDevToolsSettings['badgePosition'][] = ['top-right', 'top-left', 'bottom-right', 'bottom-left']

function read(): SrlDevToolsSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (stored && typeof stored === 'object') return { ...defaultSettings, ...stored }
  } catch {
    // no storage or invalid JSON
  }
  return { ...defaultSettings }
}

export const settings = ref<SrlDevToolsSettings>(read())

let writing = false
watch(
  settings,
  (value) => {
    if (writing) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      // storage blocked
    }
  },
  { deep: true },
)
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return
  writing = true
  settings.value = read()
  writing = false
})

export function resetSettings() {
  settings.value = { ...defaultSettings }
}

export function openChannel(onMessage: (message: SrlDevToolsMessage) => void) {
  const channel = new BroadcastChannel(CHANNEL_NAME)
  channel.addEventListener('message', (event) => onMessage(event.data as SrlDevToolsMessage))
  return {
    post: (message: SrlDevToolsMessage) => channel.postMessage(message),
    close: () => channel.close(),
  }
}
