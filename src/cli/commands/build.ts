import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { defineCommand } from 'citty'
import { zipSync } from 'fflate'
import * as p from '@clack/prompts'
import { writeSrlScss } from '../../codegen/writeScss'
import { loadSrlConfig } from '../../config/load'
import { buildCustomers, buildEditor, buildFonts, buildPdf, buildWord, buildXbrl, type TargetContext } from '../../targets'
import { isInteractive, logger, projectRoot, readPackageJson } from '../context'
import { warnDataVersions } from './data'
import { runNuxt } from './dev'
import { notifyUpdates } from './update'

export const DEFAULT_TARGETS = ['app', 'editor', 'pdf', 'word', 'xbrl'] as const
export const ALL_TARGETS = [...DEFAULT_TARGETS, 'generate', 'server'] as const
export type BuildTarget = (typeof ALL_TARGETS)[number]

export interface BuildContext {
  root: string
  dist: string
  base: string
  version?: string
  customer?: string
}

/** Parses "-t app,editor"; "ldd" is a deprecated alias of "editor", "xhtml" of "xbrl". */
export function parseTargets(value: string | undefined): BuildTarget[] {
  if (!value) return [...DEFAULT_TARGETS]
  const targets = value.split(',').map((t) => t.trim()).filter(Boolean)
  return targets.map((target) => {
    if (target === 'ldd') {
      logger.warn('Target "ldd" is now called "editor".')
      return 'editor'
    }
    if (target === 'xhtml') return 'xbrl'
    if (!(ALL_TARGETS as readonly string[]).includes(target)) {
      throw new Error(`Unknown target "${target}". Use: ${ALL_TARGETS.join(', ')}`)
    }
    return target as BuildTarget
  })
}

export function normalizeBase(base: string | undefined): string {
  if (!base) return '/'
  return `/${base.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/')
}

export async function zipFolder(dir: string, file: string) {
  const files: Record<string, Uint8Array> = {}
  const walk = (current: string) => {
    for (const name of readdirSync(current)) {
      const full = join(current, name)
      if (statSync(full).isDirectory()) walk(full)
      else files[relative(dir, full).split('\\').join('/')] = new Uint8Array(readFileSync(full))
    }
  }
  walk(dir)
  await writeFile(file, zipSync(files, { level: 6 }))
}

/** Preview SPA for nswow (target app): data is loaded next to the app at runtime. */
async function buildApp(ctx: BuildContext) {
  await runNuxt(ctx.root, ['generate'], { SRL_MODE: 'preview', NUXT_APP_BASE_URL: ctx.base })
  const out = join(ctx.dist, 'app')
  await cp(join(ctx.root, '.output/public'), out, { recursive: true })
  await zipFolder(out, join(ctx.dist, 'app.zip'))
  logger.success(`app (preview) → ${relative(ctx.root, out)}, app.zip`)
}

/** Static delivery from data/ (run by nswow). */
async function buildGenerate(ctx: BuildContext) {
  const dataDir = join(ctx.root, 'data')
  if (!existsSync(join(dataDir, 'json/settings.json'))) {
    throw new Error('generate needs the nswow data in data/ (json/settings.json missing).')
  }
  warnDataVersions(dataDir)
  await runNuxt(ctx.root, ['generate'], { NUXT_APP_BASE_URL: ctx.base })
  const out = join(ctx.dist, 'generate')
  await cp(join(ctx.root, '.output/public'), out, { recursive: true })
  await zipFolder(out, join(ctx.dist, 'generate.zip'))
  logger.success(`generate → ${relative(ctx.root, out)}, generate.zip`)
}

async function buildServer(ctx: BuildContext) {
  await runNuxt(ctx.root, ['build'], { NUXT_APP_BASE_URL: ctx.base })
  logger.success('server → .output/ (node .output/server/index.mjs)')
}

/** editor, pdf, word, xbrl and customer PDFs: Vite builds without Nuxt. */
async function buildCssTargets(ctx: BuildContext, targets: BuildTarget[]) {
  const pkg = readPackageJson(ctx.root)
  let version = ctx.version ?? pkg.version ?? '0.0.0'
  if (targets.includes('editor') && !ctx.version && isInteractive()) {
    const answer = await p.text({ message: 'Livingdocs design version', defaultValue: version, placeholder: version })
    if (p.isCancel(answer)) throw new Error('Cancelled.')
    version = answer || version
  }
  if (version !== pkg.version) {
    await writeFile(join(ctx.root, 'package.json'), `${JSON.stringify({ ...pkg, version }, null, 2)}\n`)
  }
  const { config } = await loadSrlConfig(ctx.root, { warn: (m: string) => logger.warn(m) })
  const tctx: TargetContext = {
    root: ctx.root,
    dist: ctx.dist,
    config,
    name: pkg.name ?? 'design',
    version,
    log: (m) => logger.success(m),
    warn: (m) => logger.warn(m),
  }
  const has = (t: BuildTarget) => targets.includes(t)
  try {
    const fontsBuilt = has('editor') || has('pdf') ? await buildFonts(tctx) : false
    if (has('pdf')) await buildPdf(tctx)
    if (has('word')) await buildWord(tctx)
    if (has('xbrl')) await buildXbrl(tctx)
    let designErrors: string[] = []
    if (has('editor')) designErrors = (await buildEditor(tctx, { fontsBuilt })).errors
    if (designErrors.length) {
      for (const error of designErrors) logger.error(error)
      throw new Error(`The Livingdocs design is invalid (${designErrors.length} error(s)); design.zip was not created.`)
    }
    if (ctx.customer) await buildCustomers(tctx, ctx.customer)
  } finally {
    // the targets rewrote srl/config.scss with their values; back to the app values for the
    // dev server and the IDE
    await writeSrlScss({ rootDir: ctx.root, target: 'app', config, environment: 'development', design: { name: tctx.name, version } })
  }
  if (has('editor')) {
    await zipFolder(join(ctx.dist, 'editor'), join(ctx.dist, 'design.zip'))
    logger.success('design.zip')
  }
}

/** Targets that are built without Nuxt (editor, pdf, word, xbrl) register here. */
export const targetBuilders: Partial<Record<BuildTarget, (ctx: BuildContext) => Promise<void>>> = {
  app: buildApp,
  generate: buildGenerate,
  server: buildServer,
}

export default defineCommand({
  meta: { name: 'build', description: 'Build targets: app (preview), editor, pdf, word, xbrl, generate, server' },
  args: {
    version: { type: 'positional', description: 'Livingdocs design version (editor)', required: false },
    target: { type: 'string', alias: 't', description: `Comma separated targets (default: ${DEFAULT_TARGETS.join(',')})` },
    base: { type: 'string', description: 'Base path of the deployed site, e.g. /report/2030/' },
    customer: { type: 'string', alias: 'c', description: 'Customer PDF build (folder in pdf/customers or "all")' },
    clean: { type: 'boolean', default: true, description: 'Empty dist/ first (--no-clean keeps it)' },
  },
  async run({ args }) {
    const root = projectRoot()
    const targets = parseTargets(args.target)
    const ctx: BuildContext = {
      root,
      dist: join(root, 'dist'),
      base: normalizeBase(args.base ?? process.env.NUXT_APP_BASE_URL),
      version: args.version,
      customer: args.customer,
    }
    if (!targets.includes('generate')) await notifyUpdates(root)
    if (ctx.customer && !targets.includes('pdf')) throw new Error('--customer needs the pdf target.')
    if (args.clean) await rm(ctx.dist, { recursive: true, force: true })
    await mkdir(ctx.dist, { recursive: true })

    const cssTargets = targets.filter((t) => ['editor', 'pdf', 'word', 'xbrl'].includes(t))
    if (cssTargets.length) await buildCssTargets(ctx, cssTargets)

    for (const target of targets.filter((t) => !cssTargets.includes(t))) {
      const builder = targetBuilders[target]!
      logger.start(`Building ${target}`)
      await builder(ctx)
    }
  },
})
