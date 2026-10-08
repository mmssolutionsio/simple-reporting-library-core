import type {} from '@nuxt/nitro-server'
import type { NitroConfig } from 'nitropack'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve as resolvePath } from 'node:path'
import {
  addComponent,
  addComponentsDir,
  addImportsDir,
  addPlugin,
  addServerHandler,
  addTemplate,
  addTypeTemplate,
  createResolver,
  defineNuxtModule,
  extendPages,
  updateTemplates,
  useLogger,
} from '@nuxt/kit'
import { prerenderRoutes, readManifestFromDisk } from './data/fs'
import { setupDesignSystem } from './designSystem'
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
      // target app: SPA that loads the data next to it at runtime
      nuxt.options.ssr = false
    }

    // Runtime: composables, page, renderer
    addImportsDir(resolve('./runtime/composables'))
    addComponent({ name: 'SrlHtml', export: 'SrlHtml', filePath: resolve('./shared/html/render') })
    addPlugin(resolve('./runtime/plugins/srl-data'))
    addPlugin(resolve('./runtime/plugins/i18n'))
    addPlugin(resolve('./runtime/plugins/srl'))
    extendPages((pages) => {
      pages.push({ name: 'srl-page', path: '/:path(.*)*', file: resolve('./runtime/pages/SrlPage.vue') })
    })
    nuxt.options.build.transpile.push(resolve('./runtime'))

    // Core components (SrlMenu, SrlPageDialog, SrlArticleDialogButton, accordions, special pages, …).
    // Priority 0: a project component with the same name (app/components/Srl/Menu.vue → SrlMenu)
    // wins, because the project's component dirs have priority >= 1. Global, so special pages
    // and dynamic `<component :is="'SrlPage' + name">` resolve.
    addComponentsDir({ path: resolve('./runtime/components'), global: true, priority: 0 })

    // SRL 1 import paths used by the livingdocs Vue files and migrated project code
    nuxt.options.alias['#composables'] = resolve('./runtime/compat/composables')
    nuxt.options.alias['#utils'] = resolve('./runtime/compat/utils')
    addTypeTemplate({
      filename: 'types/srl-globals.d.ts',
      getContents: () => renderGlobalTypes(resolve('./shared/types'), resolve('./runtime/utils/menu')),
    })

    // i18n: project messages app/locales/<locale>.json (merged with translations_hosting.json at runtime)
    const localesDir = join(nuxt.options.srcDir, 'locales')
    addTemplate({ filename: 'srl/locales.mjs', getContents: () => renderLocalesTemplate(localesDir) })
    nuxt.hook('builder:watch', async (_event, path) => {
      // path is relative to srcDir or rootDir depending on the Nuxt version
      const candidates = [resolvePath(nuxt.options.srcDir, path), resolvePath(nuxt.options.rootDir, path)]
      if (candidates.some((candidate) => candidate.startsWith(localesDir))) {
        await updateTemplates({ filter: (template) => template.filename === 'srl/locales.mjs' })
      }
    })
    nuxt.options.vite.define = {
      __VUE_I18N_FULL_INSTALL__: true,
      __VUE_I18N_LEGACY_API__: false,
      __INTLIFY_PROD_DEVTOOLS__: false,
      ...nuxt.options.vite.define,
    }

    // Custom tags of the nswow HTML -> components. Core components and the livingdocs mapping
    // push into this list; call updateTemplates() after changes in dev.
    const htmlComponents: SrlHtmlComponent[] = []
    addTemplate({
      filename: 'srl/html-components.mjs',
      getContents: () => renderHtmlComponentsTemplate(htmlComponents),
    })
    // Core tags render the Nuxt component of the same name, so project overrides apply here too.
    const coreTags: Record<string, string> = {
      'srl-article-dialog-button': 'SrlArticleDialogButton',
      'srl-article-accordion': 'SrlArticleAccordion',
      'srl-category-accordion': 'SrlCategoryAccordion',
      'srl-category-accordion-toggle': 'SrlCategoryAccordionToggle',
      'srl-category-accordion-content': 'SrlCategoryAccordionContent',
    }
    const coreEntries: SrlHtmlComponent[] = Object.entries(coreTags).map(([tag, name]) => ({
      tag,
      filePath: resolve(`./runtime/components/${name.replace(/(?!^)(?=[A-Z])/g, '/')}.vue`),
      priority: 0,
    }))
    htmlComponents.push(...coreEntries)
    nuxt.hook('components:extend', (components) => {
      for (const entry of coreEntries) {
        const winner = components.find((component) => component.pascalName === coreTags[entry.tag] && component.mode !== 'server')
        if (winner) entry.filePath = winner.filePath
      }
    })

    await setupDesignSystem(nuxt, htmlComponents, () =>
      updateTemplates({ filter: (template) => template.filename === 'srl/html-components.mjs' }),
    )

    if (preview) {
      // Data is fetched next to the app at runtime; nothing to prerender. In dev the data folder is
      // served at the app root (where nswow puts it next to the preview build).
      if (nuxt.options.dev) {
        nuxt.hook('nitro:config', (config: NitroConfig) => {
          config.publicAssets ??= []
          if (existsSync(dataDir)) config.publicAssets.push({ dir: dataDir, baseURL: '/', maxAge: 0 })
        })
      }
      return
    }

    // Data on the server: json/html as server assets, images/downloads as public assets
    nuxt.hook('nitro:config', (config: NitroConfig) => {
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
      nitro.hooks.hook('prerender:routes', async (routes: Set<string>) => {
        // only nuxt generate writes the pages; server builds render them live from data/
        if (!nitro.options.static) return
        const manifest = await readManifestFromDisk(dataDir, { navigationMenu: options.navigationMenu })
        if (!manifest) {
          throw new Error(`[srl] No data found in ${dataDir}. nuxt generate needs data/json/settings.json.`)
        }
        for (const issue of manifest.table.issues) logger.warn(`[${issue.locale}] ${issue.message}`)
        for (const route of prerenderRoutes(manifest)) routes.add(route)
      })
    })
  },
})

/** `export default { en: {...}, de: {...} }` from <srcDir>/locales/*.json. */
function renderLocalesTemplate(dir: string): string {
  const files = existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith('.json')).sort() : []
  const imports = files.map((file, i) => `import m${i} from ${JSON.stringify(join(dir, file))}`)
  const entries = files.map((file, i) => `  ${JSON.stringify(file.slice(0, -'.json'.length))}: m${i},`)
  return [...imports, '', 'export default {', ...entries, '}', ''].join('\n')
}

/** SRL 1 declared the nswow types globally; livingdocs Vue files still use them without import. */
function renderGlobalTypes(sharedTypes: string, menuTypes: string): string {
  return `import type * as Srl from ${JSON.stringify(sharedTypes)}
import type { SrlNavigationItem } from ${JSON.stringify(menuTypes)}

declare global {
  type NsWowSettings = Srl.NsWowSettings
  type NsWowArticle = Srl.NsWowArticle
  type NsWowMenu = Srl.NsWowMenu
  type NsWowRouting = Srl.NsWowRouting
  type NsWowTranslations = Srl.NsWowTranslations
  type NsWowDownload = Srl.NsWowDownload
  type NsWowDownloads = Srl.NsWowDownloads
  type NsWowNavigationItem = SrlNavigationItem
}

export {}
`
}
