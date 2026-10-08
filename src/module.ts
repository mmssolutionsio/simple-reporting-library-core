import { existsSync } from 'node:fs'
import { join, resolve as resolvePath } from 'node:path'
import {
  addComponent,
  addImportsDir,
  addPlugin,
  addServerHandler,
  addTemplate,
  createResolver,
  defineNuxtModule,
  extendPages,
  useLogger,
} from '@nuxt/kit'
import { prerenderRoutes, readManifestFromDisk } from './data/fs'
import { renderHtmlComponentsTemplate, type SrlHtmlComponent } from './htmlComponents'

export type SrlMode = 'static' | 'preview'

export interface ModuleOptions {
  /** Folder with the nswow data (json/, html/, images/, downloads/), relative to the project root. */
  dataDir: string
  /** Menu whose hierarchy defines the URLs. */
  navigationMenu: string
  /**
   * static: data is read on the server / at build time (generate, SSR).
   * preview: client-only SPA that loads the data at runtime (target `app`).
   * Defaults to the SRL_MODE environment variable, otherwise static.
   */
  mode: SrlMode
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@simple-reporting/core',
    configKey: 'srl',
  },
  defaults: {
    dataDir: 'data',
    navigationMenu: 'navigation',
    mode: process.env.SRL_MODE === 'preview' ? 'preview' : 'static',
  },
  async setup(options, nuxt) {
    const logger = useLogger('srl')
    const { resolve } = createResolver(import.meta.url)
    const dataDir = resolvePath(nuxt.options.rootDir, options.dataDir)
    const preview = options.mode === 'preview'

    nuxt.options.runtimeConfig.public.srl = {
      mode: options.mode,
      navigationMenu: options.navigationMenu,
    }

    if (preview) {
      nuxt.options.ssr = false
    }

    // Runtime: composables, page, renderer
    addImportsDir(resolve('./runtime/composables'))
    addComponent({ name: 'SrlHtml', export: 'SrlHtml', filePath: resolve('./shared/html/render') })
    addPlugin(resolve('./runtime/plugins/srl-data'))
    addPlugin(resolve('./runtime/plugins/srl'))
    extendPages((pages) => {
      pages.push({ name: 'srl-page', path: '/:path(.*)*', file: resolve('./runtime/pages/SrlPage.vue') })
    })

    // Custom tags of the nswow HTML -> components. Core components and the livingdocs mapping
    // push into this list; call updateTemplates() after changes in dev.
    const htmlComponents: SrlHtmlComponent[] = []
    addTemplate({
      filename: 'srl/html-components.mjs',
      getContents: () => renderHtmlComponentsTemplate(htmlComponents),
    })

    if (preview) {
      // Data is fetched next to the app at runtime; nothing to serve or prerender.
      return
    }

    // Data on the server: json/html as server assets, images/downloads as public assets
    nuxt.hook('nitro:config', (config) => {
      config.serverAssets ??= []
      config.serverAssets.push(
        { baseName: 'srl-json', dir: join(dataDir, 'json') },
        { baseName: 'srl-html', dir: join(dataDir, 'html') },
        { baseName: 'srl-downloads', dir: join(dataDir, 'downloads'), pattern: '*.json' },
      )
      config.publicAssets ??= []
      for (const folder of ['images', 'downloads']) {
        if (existsSync(join(dataDir, folder))) {
          config.publicAssets.push({ dir: join(dataDir, folder), baseURL: `/${folder}`, maxAge: 60 * 60 * 24 * 7 })
        }
      }
    })

    addServerHandler({ route: '/_srl/manifest.json', handler: resolve('./runtime/server/routes/manifest') })
    addServerHandler({ route: '/_srl/article/:locale/:file', handler: resolve('./runtime/server/routes/article') })
    addServerHandler({ route: '/_srl/search/:file', handler: resolve('./runtime/server/routes/search') })

    // nuxt generate: write every page, redirect and JSON endpoint from the route table
    nuxt.hook('nitro:init', (nitro) => {
      nitro.options.prerender.crawlLinks = false
      nitro.options.prerender.failOnError = true
      nitro.hooks.hook('prerender:routes', async (routes) => {
        const manifest = await readManifestFromDisk(dataDir, { navigationMenu: options.navigationMenu })
        if (!manifest) {
          if (nuxt.options.nitro.static || nuxt.options._generate) {
            throw new Error(`[srl] No data found in ${dataDir}. nuxt generate needs data/json/settings.json.`)
          }
          return
        }
        for (const issue of manifest.table.issues) logger.warn(`[${issue.locale}] ${issue.message}`)
        for (const route of prerenderRoutes(manifest)) routes.add(route)
      })
    })
  },
})
