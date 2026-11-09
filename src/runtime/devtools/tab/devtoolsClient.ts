// The Nuxt DevTools set window.__NUXT_DEVTOOLS__ on the iframe of a custom tab (same as
// @nuxt/devtools-kit/iframe-client, without importing it into the page: no extra Vite dep).
import { shallowRef, triggerRef, type ShallowRef } from 'vue'

type DevtoolsClient = {
  devtools?: { colorMode?: string }
  host?: { hooks?: { hook: (name: string, fn: () => void) => void } }
}

let client: ShallowRef<DevtoolsClient | undefined> | undefined

export function useNuxtDevtoolsClient(): ShallowRef<DevtoolsClient | undefined> {
  if (client) return client
  const ref = shallowRef<DevtoolsClient | undefined>()
  client = ref
  const w = window as unknown as { __NUXT_DEVTOOLS__?: DevtoolsClient }
  const setup = (value: DevtoolsClient | undefined) => {
    ref.value = value
    value?.host?.hooks?.hook('host:update:reactivity', () => triggerRef(ref))
  }
  let current = w.__NUXT_DEVTOOLS__
  if (current) setup(current)
  Object.defineProperty(window, '__NUXT_DEVTOOLS__', {
    configurable: true,
    get: () => current,
    set: (value: DevtoolsClient | undefined) => {
      current = value
      if (value) setup(value)
    },
  })
  return ref
}
