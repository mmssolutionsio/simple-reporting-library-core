// Dev only (registered by the module in `srl dev`): grid overlay and viewport badge of the SRL tab
// in the Nuxt DevTools. Loaded after mount, so it never affects SSR or hydration.
import { defineNuxtPlugin } from '#imports'

export default defineNuxtPlugin({
  name: 'srl-devtools',
  setup(nuxtApp) {
    nuxtApp.hook('app:mounted', async () => {
      const { mountSrlDevToolsOverlay } = await import('../devtools/overlay/mount')
      mountSrlDevToolsOverlay()
    })
  },
})
