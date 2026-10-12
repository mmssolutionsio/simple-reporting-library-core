import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import { build as viteBuild, type InlineConfig } from 'vite'
import { detectFontAwesomeType, srlScssAliases, writeSrlScss } from '../codegen/writeScss'
import { resolveDesignBaseUrl } from '../codegen/scssEntries'
import type { SrlConfig } from '../config/types'
import { buildEditorDesign } from '../livingdocs/design'
import { validateDesign } from '../livingdocs/validator'

export type CssTarget = 'editor' | 'pdf' | 'word' | 'xbrl'

export interface TargetContext {
  root: string
  /** Output folder (dist/). */
  dist: string
  config: SrlConfig
  /** package.json name and version (design name/version). */
  name: string
  version: string
  log: (message: string) => void
  warn: (message: string) => void
}

const corePackageDir = join(dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)

/** Shared Vite config of the CSS/PDF targets: no Nuxt, no project vite config. */
async function viteConfig(ctx: TargetContext, target: CssTarget, extra: InlineConfig): Promise<InlineConfig> {
  const scss = await writeSrlScss({
    rootDir: ctx.root,
    target,
    config: ctx.config,
    design: { name: ctx.name, version: ctx.version },
  })
  for (const warning of scss.warnings) ctx.warn(warning)
  return {
    configFile: false,
    root: ctx.root,
    base: './',
    publicDir: false,
    logLevel: 'warn',
    resolve: {
      alias: {
        ...srlScssAliases(scss.srlDir, detectFontAwesomeType(ctx.root)),
        '#srl-target-entry': scss.entry,
        '@simple-reporting/core/pdf': join(corePackageDir, 'pdf'),
        '@simple-reporting/core/scss': join(corePackageDir, 'scss'),
        'modern-css-reset': require.resolve('modern-css-reset/dist/reset.min.css'),
        // same as Nuxt (srcDir app/), so files shared with the site resolve identically
        '~': join(ctx.root, 'app'),
        '~~': ctx.root,
        '@': join(ctx.root, 'app'),
        assets: join(ctx.root, 'app/assets'),
      },
    },
    ...extra,
    // esbuild like SRL 1: lightningcss (Vite 8 default) rewrites selector lists to :is(), which changes
    // specificity and is not understood by every renderer (Word, PDFreactor, XBRL viewers)
    build: { emptyOutDir: true, cssMinify: 'esbuild', ...extra.build },
  }
}

/** CSS-only target: compiles the target entry to <outDir>/<fileName>.css. */
async function buildCss(ctx: TargetContext, target: CssTarget, outDir: string, fileName: string) {
  const config = await viteConfig(ctx, target, {})
  const scssEntry = (config.resolve!.alias as Record<string, string>)['#srl-target-entry']!
  // Vite 8 fails on pure CSS entries (vite:css-post referenceId); a JS entry that imports the CSS works
  const entry = scssEntry.replace(/\.scss$/, '.entry.js')
  await writeFile(entry, `import ${JSON.stringify(`./${basename(scssEntry)}`)}\n`)
  await viteBuild({
    ...config,
    build: {
      ...config.build,
      outDir,
      cssCodeSplit: false,
      lib: { entry, formats: ['es'], fileName: () => `${fileName}.js`, cssFileName: fileName },
    },
  })
  // a CSS entry produces an (empty) JS file
  await rm(join(outDir, `${fileName}.js`), { force: true })
}

/** Font files from app/assets/fonts → dist/fonts (style.css + files). Returns false when there are none. */
export async function buildFonts(ctx: TargetContext): Promise<boolean> {
  const fontsDir = join(ctx.root, 'app/assets/fonts')
  const files: string[] = []
  const walk = (dir: string) => {
    if (!existsSync(dir)) return
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (name.endsWith('.scss')) files.push(full)
    }
  }
  walk(fontsDir)
  if (!files.length) return false

  const entryDir = join(ctx.root, '.srl/scss/fonts')
  await mkdir(entryDir, { recursive: true })
  const entry = join(entryDir, 'style.scss')
  await writeFile(entry, files.map((f) => `@use "${relative(entryDir, f).split('\\').join('/')}" as *;`).join('\n') + '\n')

  const config = await viteConfig(ctx, 'editor', {})
  await viteBuild({
    ...config,
    build: {
      ...config.build,
      outDir: join(ctx.dist, 'fonts'),
      assetsInlineLimit: 0,
      assetsDir: '',
      rollupOptions: {
        input: { style: entry },
        output: {
          entryFileNames: '[name].js',
          assetFileNames: (asset) => (/\.css$/.test(asset.names?.[0] ?? asset.name ?? '') ? '[name][extname]' : '[name]-[hash][extname]'),
        },
      },
    },
  })
  await rm(join(ctx.dist, 'fonts/style.js'), { force: true })
  ctx.log('fonts → dist/fonts')
  return true
}

/** PDF: project pdf/entry.ts (imports '#srl-target-entry' and the PDFreactor helpers). */
export async function buildPdf(ctx: TargetContext) {
  const entry = join(ctx.root, 'pdf/entry.ts')
  if (!existsSync(entry)) throw new Error('pdf/entry.ts is missing.')
  const outDir = join(ctx.dist, 'pdf')
  const config = await viteConfig(ctx, 'pdf', {})
  await viteBuild({
    ...config,
    build: {
      ...config.build,
      outDir,
      cssCodeSplit: false,
      lib: { entry, formats: ['es'], fileName: () => 'pdf.js', cssFileName: 'pdf' },
    },
  })
  ctx.log('pdf → dist/pdf (pdf.js, pdf.css)')
}

export async function buildWord(ctx: TargetContext) {
  await buildCss(ctx, 'word', join(ctx.dist, 'word'), 'word')
  ctx.log('word → dist/word/word.css')
}

export async function buildXbrl(ctx: TargetContext) {
  const outDir = join(ctx.dist, 'xbrl')
  await buildCss(ctx, 'xbrl', outDir, 'xbrl')
  const removed = await stripMediaFromCss(join(outDir, 'xbrl.css'))
  ctx.log(`xbrl → dist/xbrl/xbrl.css (${removed} @media blocks removed)`)
}

/** XBRL renders without media queries: removes every @media at-rule. */
export async function stripMediaFromCss(file: string): Promise<number> {
  let removed = 0
  const result = await postcss([
    {
      postcssPlugin: 'srl-remove-media',
      AtRule: {
        media: (rule) => {
          removed++
          rule.remove()
        },
      },
    },
  ]).process(await readFile(file, 'utf8'), { from: file })
  await writeFile(file, result.css)
  return removed
}

export interface EditorBuildResult {
  designFile: string
  errors: string[]
}

/** Livingdocs design: editor.css, fonts, design.json (validated). Never writes livingdocs.config.json. */
export async function buildEditor(ctx: TargetContext, { fontsBuilt }: { fontsBuilt: boolean }): Promise<EditorBuildResult> {
  const outDir = join(ctx.dist, 'editor')
  await buildCss(ctx, 'editor', join(outDir, 'assets'), 'editor')
  if (fontsBuilt) await cp(join(ctx.dist, 'fonts'), join(outDir, 'fonts'), { recursive: true })

  const configFile = join(ctx.root, 'livingdocs.config.json')
  const baseConfig = existsSync(configFile) ? JSON.parse(readFileSync(configFile, 'utf8')) : {}
  const { design, warnings } = await buildEditorDesign({
    livingdocsDir: join(ctx.root, 'livingdocs'),
    baseConfig,
    name: ctx.name,
    version: ctx.version,
    assets: { css: ['./assets/editor.css'], js: [] },
  })
  const validation = validateDesign(design)
  for (const message of [...warnings, ...validation.warnings]) ctx.warn(message)

  const designFile = join(outDir, 'design.json')
  await writeFile(designFile, `${JSON.stringify(design, null, 2)}\n`)
  await writeFile(join(ctx.dist, `v${ctx.version}.txt`), `${ctx.version}\n`)
  ctx.log(`editor → dist/editor (design.json ${ctx.name}@${ctx.version})`)
  return { designFile, errors: validation.errors }
}

/** Customer PDF builds: pdf/customers/<name>/{custom.ts,custom.scss,public/} → dist/editor/pdf/<name>/ */
export async function buildCustomers(ctx: TargetContext, customer: string) {
  const customersDir = join(ctx.root, 'pdf/customers')
  const customers =
    customer === 'all'
      ? existsSync(customersDir)
        ? readdirSync(customersDir).filter((name) => statSync(join(customersDir, name)).isDirectory())
        : []
      : [customer]
  const designUrl = `${resolveDesignBaseUrl(process.env)}/${ctx.name}/${ctx.version}/pdf`
  const editorDir = join(ctx.dist, 'editor')

  // the design carries the target files the customers reference (xbrl already without @media)
  for (const target of ['pdf', 'word', 'xbrl']) {
    if (existsSync(join(ctx.dist, target))) await cp(join(ctx.dist, target), join(editorDir, target), { recursive: true })
  }

  for (const name of customers) {
    const customerDir = join(customersDir, name)
    if (!existsSync(customerDir)) throw new Error(`Customer "${name}" does not exist in pdf/customers.`)
    const customerName = name.split('-')[0]!
    const target = join(editorDir, 'pdf', customerName)
    await mkdir(target, { recursive: true })
    const js = ['pdf.js']
    const css = ['pdf.css']

    if (existsSync(join(customerDir, 'custom.ts'))) {
      const config = await viteConfig(ctx, 'pdf', {})
      await viteBuild({
        ...config,
        build: {
          ...config.build,
          emptyOutDir: false,
          outDir: target,
          assetsInlineLimit: 0,
          assetsDir: '',
          rollupOptions: {
            input: join(customerDir, 'custom.ts'),
            output: {
              entryFileNames: '[name].js',
              chunkFileNames: '[name].js',
              assetFileNames: (asset) => (/\.css$/.test(asset.names?.[0] ?? asset.name ?? '') ? '[name][extname]' : 'assets/[name]-[hash][extname]'),
            },
          },
        },
      })
      js.push(`${customerName}/custom.js`)
      if (existsSync(join(target, 'custom.css'))) css.push(`${customerName}/custom.css`)
    }

    if (existsSync(join(customerDir, 'custom.scss'))) {
      const xbrlTarget = join(editorDir, 'xbrl', customerName)
      const config = await viteConfig(ctx, 'xbrl', {})
      const entry = join(ctx.root, '.srl/scss/entries', `xbrl-${customerName}.scss`)
      await writeFile(entry, `@use "xbrl";\n@use "${relative(dirname(entry), join(customerDir, 'custom.scss')).split('\\').join('/')}";\n`)
      await viteBuild({
        ...config,
        build: {
          ...config.build,
          outDir: xbrlTarget,
          rollupOptions: { input: { xbrl: entry }, output: { assetFileNames: '[name][extname]', entryFileNames: '[name].js' } },
        },
      })
      await rm(join(xbrlTarget, 'xbrl.js'), { force: true })
      await stripMediaFromCss(join(xbrlTarget, 'xbrl.css'))
    }

    if (existsSync(join(customerDir, 'public'))) {
      await cp(join(customerDir, 'public'), join(target, 'public'), { recursive: true })
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry)
          if (statSync(full).isDirectory()) walk(full)
          else if (entry.endsWith('.css')) css.push(relative(join(editorDir, 'pdf'), full).split('\\').join('/'))
          else if (entry.endsWith('.js')) js.push(relative(join(editorDir, 'pdf'), full).split('\\').join('/'))
        }
      }
      walk(join(target, 'public'))
    }

    const refs = [
      ...css.map((p) => `  <userStyleSheets><uri>${designUrl}/${p}</uri></userStyleSheets>`),
      ...js.map((p) => `  <userScripts><beforeDocumentScripts>true</beforeDocumentScripts><uri>${designUrl}/${p}</uri></userScripts>`),
    ].join('\n')
    const xml = (settings: string) =>
      `<configuration xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n${settings}${refs}\n</configuration>`
    await writeFile(join(target, 'pdf-configuration.xml'), xml('  <appendLog>false</appendLog>\n'))
    await writeFile(
      join(target, 'pdf-configuration-debug.xml'),
      xml('  <appendLog>true</appendLog>\n  <inspectableSettings><enabled>true</enabled></inspectableSettings>\n  <debugSettings><all>true</all></debugSettings>\n'),
    )
    ctx.log(`customer ${name} → dist/editor/pdf/${customerName}`)
  }
}

