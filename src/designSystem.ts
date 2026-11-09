import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, relative } from 'node:path'
import type { Nuxt } from '@nuxt/schema'
import { addComponent, addDevServerHandler, addTemplate, addTypeTemplate, addVitePlugin, updateTemplates, useLogger } from '@nuxt/kit'
import { defineEventHandler } from 'h3'
import svgLoader from 'vite-svg-loader'
import { renderUseSrlDesignConfig, renderUseSrlDesignConfigTypes } from './codegen/designConfig'
import { detectFontAwesomeType, srlScssAliases, writeSrlScss } from './codegen/writeScss'
import { loadSrlConfig } from './config/load'
import type { SrlConfig } from './config/types'
import type { SrlHtmlComponent } from './htmlComponents'
import { buildEditorDesign, livingdocsVueComponents } from './livingdocs/design'
import { validateDesign } from './livingdocs/validator'

const require = createRequire(import.meta.url)

/**
 * Design system of the project inside Nuxt (replaces SRL 1 viteSrlPlugin):
 * srl.config → tokens SCSS (`@use 'srl'`), app entry stylesheet, useSrlDesignConfig(),
 * livingdocs Vue components (SrlLd*), dev watchers and /_srl/editor/design.json in dev.
 */
export async function setupDesignSystem(nuxt: Nuxt, htmlComponents: SrlHtmlComponent[], refreshHtmlComponents: () => Promise<void>) {
  const logger = useLogger('srl')
  const rootDir = nuxt.options.rootDir
  const livingdocsDir = join(rootDir, 'livingdocs')
  const environment = nuxt.options.dev ? 'development' : 'production'
  let config: SrlConfig = {}

  const loadConfig = async () => {
    const loaded = await loadSrlConfig(rootDir, { warn: (message) => logger.warn(message) })
    config = loaded.config
    return loaded
  }
  const writeScss = async () => {
    const result = await writeSrlScss({ rootDir, target: 'app', config, environment })
    for (const warning of result.warnings) logger.warn(warning)
    return result
  }

  await loadConfig()
  const scss = await writeScss()

  // livingdocs/ is outside srcDir (app/): add it to the generated app tsconfig, so IDEs (VS Code
  // with Vue, PhpStorm) resolve aliases (#composables, ~, @), auto-imports and types there too
  nuxt.hook('prepare:types', ({ tsConfig }) => {
    const dir = relative(nuxt.options.buildDir, livingdocsDir).split('\\').join('/')
    tsConfig.include ??= []
    for (const pattern of [`${dir}/**/*`, `${dir}/**/*.vue`]) {
      if (!tsConfig.include.includes(pattern)) tsConfig.include.push(pattern)
    }
  })

  // `@use 'srl'` in every component/project stylesheet, Font Awesome free/pro helpers
  Object.assign(nuxt.options.alias, srlScssAliases(scss.srlDir, detectFontAwesomeType(rootDir)))
  nuxt.options.alias['modern-css-reset'] ??= require.resolve('modern-css-reset/dist/reset.min.css')
  nuxt.options.css.push(scss.entry)
  // same CSS minifier as the targets: lightningcss rewrites selector lists to :is() (other specificity)
  nuxt.options.vite.build = { ...nuxt.options.vite.build, cssMinify: 'esbuild' }

  // `assets/images/x.svg?component` in livingdocs files (SRL 1 used vite-svg-loader)
  addVitePlugin(svgLoader({ defaultImport: 'url' }))
  // Types of the vite-svg-loader imports, inline: the package is a core dependency and usually not
  // resolvable from the project (no `/// <reference types="vite-svg-loader" />` possible)
  addTypeTemplate({ filename: 'srl/svg.d.ts', getContents: () => SVG_IMPORT_TYPES })

  addTemplate({ filename: 'srl/design-config.mjs', getContents: () => renderUseSrlDesignConfig(config) })
  addTypeTemplate({ filename: 'srl/design-config.d.ts', getContents: () => renderUseSrlDesignConfigTypes() })
  nuxt.options.alias['#srl/design-config'] = join(nuxt.options.buildDir, 'srl/design-config.mjs')
  nuxt.hook('imports:extend', (imports) => {
    imports.push({ name: 'useSrlDesignConfig', from: join(nuxt.options.buildDir, 'srl/design-config.mjs') })
  })

  // livingdocs/**/<name>.vue → global SrlLd<Name>, used as <srl-ld-<name>> in the nswow HTML
  const livingdocsComponents = livingdocsVueComponents(livingdocsDir)
  for (const component of livingdocsComponents) {
    addComponent({ name: component.name, filePath: component.filePath, global: true, priority: 1 })
  }
  htmlComponents.push(...livingdocsComponents)

  if (!nuxt.options.dev) return

  // full design in dev (never written to livingdocs.config.json)
  addDevServerHandler({
    route: '/_srl/editor/design.json',
    handler: defineEventHandler(async () => {
      const configFile = join(rootDir, 'livingdocs.config.json')
      const baseConfig = existsSync(configFile) ? JSON.parse(readFileSync(configFile, 'utf8')) : {}
      const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'))
      const { design, warnings } = await buildEditorDesign({ livingdocsDir, baseConfig, name: pkg.name, version: pkg.version })
      return { validation: validateDesign(design), warnings, design }
    }),
  })

  // Watchers: own chokidar instance because livingdocs/ and srl.config.* are outside srcDir.
  // One debounce per action (SRL 1 shared one timer and dropped actions).
  const { watch } = await import('chokidar')
  const timers = new Map<string, NodeJS.Timeout>()
  const debounce = (key: string, action: () => Promise<unknown>) => {
    clearTimeout(timers.get(key))
    timers.set(
      key,
      setTimeout(() => action().catch((error) => logger.error(error)), 150),
    )
  }
  const watcher = watch(
    [livingdocsDir, join(nuxt.options.srcDir, 'assets/scss'), join(nuxt.options.srcDir, 'assets/fonts'), ...['srl.config.ts', 'srl.config.json'].map((f) => join(rootDir, f))],
    { ignoreInitial: true, ignored: (path) => path.includes('node_modules') },
  )
  watcher.on('all', (event, path) => {
    const file = relative(rootDir, path)
    if (/^srl\.config\.(ts|json)$/.test(file)) {
      debounce('config', async () => {
        await loadConfig()
        await writeScss()
        await updateTemplates({ filter: (t) => t.filename === 'srl/design-config.mjs' })
      })
    } else if (event === 'add' || event === 'unlink' || event === 'addDir' || event === 'unlinkDir') {
      debounce('scss', writeScss)
      if (file.endsWith('.vue') && file.startsWith('livingdocs')) {
        const current = livingdocsVueComponents(livingdocsDir)
        htmlComponents.splice(0, htmlComponents.length, ...htmlComponents.filter((c) => !c.filePath.startsWith(livingdocsDir)), ...current)
        debounce('html-components', refreshHtmlComponents)
        logger.info(`livingdocs Vue component ${event === 'add' ? 'added' : 'removed'}: restart dev for the global SrlLd* registration.`)
      }
    }
  })
  nuxt.hook('close', () => watcher.close())
}

/** `*.svg?component|url|raw|skipsvgo` (vite-svg-loader); plain `*.svg` is a URL string (vite/client). */
const SVG_IMPORT_TYPES = `declare module '*.svg?component' {
  import type { FunctionalComponent, SVGAttributes } from 'vue'
  const src: FunctionalComponent<SVGAttributes>
  export default src
}

declare module '*.svg?skipsvgo' {
  import type { FunctionalComponent, SVGAttributes } from 'vue'
  const src: FunctionalComponent<SVGAttributes>
  export default src
}

declare module '*.svg?url' {
  const src: string
  export default src
}

declare module '*.svg?raw' {
  const src: string
  export default src
}
`
