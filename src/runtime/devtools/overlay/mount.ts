// Mounts the overlay as its own small Vue app next to the Nuxt app, so it never takes part in the
// rendering or hydration of the page.
import { createApp } from 'vue'
import { trackViewport } from '../state'
import Overlay from './Overlay.vue'

export function mountSrlDevToolsOverlay() {
  if (document.getElementById('srl-devtools-overlay')) return
  const el = document.createElement('div')
  el.id = 'srl-devtools-overlay'
  document.body.append(el)
  trackViewport('page')
  createApp(Overlay).mount(el)
}
