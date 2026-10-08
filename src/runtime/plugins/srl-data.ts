import { createError, defineNuxtPlugin, useRuntimeConfig } from '#imports'
import { assembleManifest, type SrlRawData } from '../../shared/manifest'
import { useSrlConfig } from '../composables/srl'
import { loadPreviewManifest } from '../utils/preview'

/**
 * Loads the nswow data once (not part of the page payload: the static file
 * /_srl/manifest.json is cached by the browser) and builds the route table.
 */
export default defineNuxtPlugin({
  name: 'srl-data',
  enforce: 'pre',
  async setup() {
    const { navigationMenu, mode } = useSrlConfig()
    if (mode === 'preview') {
      // data next to the app, read fresh on every page load
      try {
        return { provide: { srlManifest: await loadPreviewManifest(useRuntimeConfig().app.baseURL, navigationMenu) } }
      } catch (cause) {
        throw createError({ statusCode: 500, statusMessage: 'Preview data (json/settings.json) could not be loaded', fatal: true, cause })
      }
    }
    let raw: SrlRawData
    try {
      raw = await $fetch<SrlRawData>('/_srl/manifest.json')
    } catch (cause) {
      throw createError({ statusCode: 500, statusMessage: 'SRL data could not be loaded', fatal: true, cause })
    }
    return { provide: { srlManifest: assembleManifest(raw, { navigationMenu }) } }
  },
})
