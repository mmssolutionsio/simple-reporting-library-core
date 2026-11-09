/**
 * SCSS entry files per build target. Port of SRL 1 `mapScss` and
 * `mapIndexScss` (`scripts/build.js`), split into a scanner (file system) and
 * pure renderers.
 *
 * Differences to SRL 1:
 * - Target `ldd` is called `editor`. Component and project `editor.scss` go
 *   into it; a legacy `ldd.scss` is still picked up, with a warning.
 * - Source folders are configurable (SRL 2 default: `app/assets/scss`,
 *   `app/assets/fonts`, `livingdocs`).
 * - All paths are relative to the folder the generated file lives in.
 * - The shared properties group (`999.Properties`) is reliably placed last:
 *   SRL 1 compared the folder name including its numeric prefix, so the
 *   filter never matched.
 * - Font files are sorted (SRL 1 used unsorted glob order).
 * - The design URL is an input instead of an env read.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { SRL_SCSS_PACKAGE, type SrlBuildTarget } from './tokens'

const posix = path.posix

export interface ScssSourceDirs {
  /** Project SCSS (`general.scss`, `app.scss`, …, `placeholders/**`). */
  scssDir?: string
  /** Font SCSS (`**\/*.scss`). */
  fontsDir?: string
  /** Livingdocs components (`<NNN.Group>/<NNN.component>/scss/<target>.scss`). */
  livingdocsDir?: string
}

export const DEFAULT_SCSS_SOURCE_DIRS: Required<ScssSourceDirs> = {
  scssDir: 'app/assets/scss',
  fontsDir: 'app/assets/fonts',
  livingdocsDir: 'livingdocs',
}

export interface LivingdocsScssDir {
  /** Absolute path of a group or component folder. */
  dir: string
  /** Path relative to the livingdocs folder, posix. */
  relative: string
  /** True for the shared properties group and its children. */
  isProperties: boolean
  /** Basenames of the files present in `<dir>/scss/`. */
  scssFiles: string[]
}

export interface ScssSources {
  rootDir: string
  /** Absolute paths of `<scssDir>/*.scss`. */
  mainFiles: string[]
  /** Absolute paths of `<fontsDir>/**\/*.scss`, sorted. */
  fontFiles: string[]
  /** Absolute paths of `<scssDir>/placeholders/**\/*.scss`, sorted by file name. */
  placeholderFiles: string[]
  /** Group and component folders in output order. */
  livingdocs: LivingdocsScssDir[]
}

/** Strips the numeric ordering prefix of a livingdocs folder (`999.Properties` → `Properties`). */
export function stripOrderPrefix(name: string): string {
  return name.replace(/^\d+\./, '')
}

const PROPERTIES_GROUP = 'Properties'

/**
 * Scans the project for the SCSS sources that go into the entry files.
 */
export function scanScssSources(rootDir: string, dirs: ScssSourceDirs = {}): ScssSources {
  const d = { ...DEFAULT_SCSS_SOURCE_DIRS, ...dirs }
  const scssDir = path.resolve(rootDir, d.scssDir)
  const fontsDir = path.resolve(rootDir, d.fontsDir)
  const ldDir = path.resolve(rootDir, d.livingdocsDir)

  const mainFiles = listDir(scssDir)
    .filter((e) => e.isFile() && e.name.endsWith('.scss'))
    .map((e) => path.join(scssDir, e.name))
    .sort(compareCaseInsensitive)

  const fontFiles = walk(fontsDir)
    .filter((f) => f.endsWith('.scss'))
    .sort((a, b) => compareCaseInsensitive(path.relative(fontsDir, a), path.relative(fontsDir, b)))

  // SRL 1 sorted placeholders by file name only (case-sensitive).
  const placeholderFiles = walk(path.join(scssDir, 'placeholders'))
    .filter((f) => f.endsWith('.scss'))
    .sort((a, b) => {
      const na = path.basename(a)
      const nb = path.basename(b)
      return na < nb ? -1 : na > nb ? 1 : a < b ? -1 : a > b ? 1 : 0
    })

  const folders: LivingdocsScssDir[] = []
  for (const group of listDir(ldDir)) {
    if (!group.isDirectory()) continue
    const groupDir = path.join(ldDir, group.name)
    const isProperties = stripOrderPrefix(group.name) === PROPERTIES_GROUP
    folders.push(ldFolder(groupDir, group.name, isProperties))
    for (const component of listDir(groupDir)) {
      if (!component.isDirectory()) continue
      folders.push(
        ldFolder(path.join(groupDir, component.name), `${group.name}/${component.name}`, isProperties),
      )
    }
  }
  folders.sort((a, b) => compareUpper(a.relative, b.relative))
  const livingdocs = [
    ...folders.filter((f) => !f.isProperties),
    ...folders.filter((f) => f.isProperties),
  ]

  return { rootDir: path.resolve(rootDir), mainFiles, fontFiles, placeholderFiles, livingdocs }
}

export interface DesignInfo {
  /** Base URL of the hosted Livingdocs designs, e.g. `https://nswow-ld.nswow.ch/designs`. */
  baseUrl: string
  /** Design name (SRL 1: `package.json` name). */
  name: string
  /** Design version (SRL 1: `package.json` version). */
  version: string
}

export const DEFAULT_DESIGN_BASE_URL = 'https://nswow-ld.nswow.ch/designs'

/** `SRL_EDITOR_DESIGN_URL ?? INTERNAL_LDD_URL ?? DEFAULT_DESIGN_BASE_URL`. */
export function resolveDesignBaseUrl(env: Record<string, string | undefined> = {}): string {
  return env.SRL_EDITOR_DESIGN_URL || env.INTERNAL_LDD_URL || DEFAULT_DESIGN_BASE_URL
}

export interface RenderScssEntriesOptions {
  /** Absolute folder the entry files are written to. */
  entriesDir: string
  /** Absolute folder of the target's `srl` module (holds `config.scss`). */
  tokensDir: (target: SrlBuildTarget) => string
  design: DesignInfo
  scssPackage?: string
}

export interface RenderedScssEntries {
  /** `app.scss`, `editor.scss`, `pdf.scss`, `word.scss`, `xbrl.scss`, `fonts.scss`. */
  files: Record<`${SrlBuildTarget}.scss` | 'fonts.scss', string>
  warnings: string[]
}

/**
 * Renders the entry file of every target plus `fonts.scss` (remote font CSS
 * for editor, pdf and word).
 */
export function renderScssEntries(
  sources: ScssSources,
  opts: RenderScssEntriesOptions,
): RenderedScssEntries {
  const pkg = opts.scssPackage ?? SRL_SCSS_PACKAGE
  const warnings: string[] = []
  const rel = (file: string) => `"${relativeTo(opts.entriesDir, file)}" as *`

  const output = {} as Record<SrlBuildTarget, string[]>
  for (const target of ['app', 'editor', 'pdf', 'word', 'xbrl'] as const) {
    output[target] = [
      `"${relativeTo(opts.entriesDir, posix.join(toPosix(opts.tokensDir(target)), 'config'))}" as *`,
      `"${pkg}/init-root.scss" as *`,
    ]
  }

  let fonts = ''
  if (sources.fontFiles.length) {
    const { baseUrl, name, version } = opts.design
    fonts = `@import "${baseUrl}/${name}/${version}/fonts/style.css";`
    for (const f of sources.fontFiles) {
      output.app.push(rel(f))
      output.xbrl.push(rel(f))
    }
    output.editor.push(`"./fonts.scss" as *`)
    output.pdf.push(`"./fonts.scss" as *`)
    output.word.push(`"./fonts.scss" as *`)
  }
  // Shared editor styles (placeholders, labels, markers) before project and component overrides.
  output.editor.push(`"${pkg}/editor-core-styles.scss" as *`)

  const byName = new Map(sources.mainFiles.map((f) => [path.basename(f), f]))
  const general = byName.get('general.scss')
  if (general) {
    for (const t of ['app', 'editor', 'pdf', 'word'] as const) output[t].push(rel(general))
  }
  const mainTargets: Array<[string, SrlBuildTarget]> = [
    ['app.scss', 'app'],
    ['ldd.scss', 'editor'],
    ['editor.scss', 'editor'],
    ['pdf.scss', 'pdf'],
    ['word.scss', 'word'],
    ['xbrl.scss', 'xbrl'],
  ]
  for (const [file, target] of mainTargets) {
    const f = byName.get(file)
    if (!f) continue
    if (file === 'ldd.scss') {
      warnings.push(
        `${relativeTo(sources.rootDir, f)}: "ldd.scss" is deprecated, rename it to "editor.scss"`,
      )
    }
    output[target].push(rel(f))
  }

  const componentTypes: Array<[string, SrlBuildTarget]> = [
    ['app', 'app'],
    ['ldd', 'editor'],
    ['editor', 'editor'],
    ['pdf', 'pdf'],
    ['word', 'word'],
    ['xbrl', 'xbrl'],
  ]
  for (const folder of sources.livingdocs) {
    const has = new Set(folder.scssFiles)
    const file = (name: string) => path.join(folder.dir, 'scss', name)
    if (has.has('general.scss')) {
      for (const t of ['app', 'editor', 'pdf', 'word'] as const) output[t].push(rel(file('general.scss')))
    }
    for (const [type, target] of componentTypes) {
      if (!has.has(`${type}.scss`)) continue
      if (type === 'ldd') {
        warnings.push(
          `${relativeTo(sources.rootDir, file('ldd.scss'))}: "ldd.scss" is deprecated, rename it to "editor.scss"`,
        )
      }
      output[target].push(rel(file(`${type}.scss`)))
    }
  }

  const render = (lines: string[], core: string) =>
    `@use ` + lines.join(';\n@use ') + `;\n@use "${pkg}/${core}" as *;\n`

  return {
    files: {
      'app.scss': render(output.app, 'core-styles.scss'),
      'editor.scss': render(output.editor, 'core-styles.scss'),
      'pdf.scss': render(output.pdf, 'core-styles.scss'),
      'word.scss': render(output.word, 'core-styles.scss'),
      'xbrl.scss': render(output.xbrl, 'xbrl-core-styles.scss'),
      'fonts.scss': fonts,
    },
    warnings,
  }
}

/**
 * Renders the `index.scss` of a target's `srl` module: config, the project's
 * placeholder files and the forwarded system modules.
 */
export function renderIndexScss(sources: ScssSources, opts: { tokensDir: string }): string {
  const map = sources.placeholderFiles.map((f) => {
    const alias = cleanupScssAlias(toPosix(path.relative(sources.rootDir, f)))
    return `@use "${relativeTo(opts.tokensDir, f)}" as ${alias};`
  })
  return [
    `@use './config';`,
    ...map,
    `@forward './system' as system-*;`,
    `@forward './fonts' as fonts-*;`,
    `@forward './grid' as grid-*;`,
    `@forward './colors' as colors-*;`,
    `@forward './typography' as typography-*;`,
    `@forward './helpers' as helpers-*;`,
    `@forward './editor' as editor-*;`,
    `@forward './spacer' as spacer-*;`,
    `@forward "./button" as button-*;`,
    `@forward './meta';`,
  ].join('\n')
}

function cleanupScssAlias(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '')
}

/** Posix path from `fromDir` to `file`, always starting with `./` or `../`. */
function relativeTo(fromDir: string, file: string): string {
  const r = toPosix(path.relative(fromDir, file))
  return r.startsWith('.') ? r : `./${r}`
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}

function compareUpper(a: string, b: string): number {
  const ua = a.toUpperCase()
  const ub = b.toUpperCase()
  return ua < ub ? -1 : ua > ub ? 1 : 0
}

function compareCaseInsensitive(a: string, b: string): number {
  return compareUpper(a, b) || (a < b ? -1 : a > b ? 1 : 0)
}

function listDir(dir: string) {
  try {
    return readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of listDir(dir)) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (e.isFile()) out.push(p)
  }
  return out
}

function ldFolder(dir: string, relative: string, isProperties: boolean): LivingdocsScssDir {
  const scssDir = path.join(dir, 'scss')
  let scssFiles: string[] = []
  if (existsSync(scssDir) && statSync(scssDir).isDirectory()) {
    scssFiles = readdirSync(scssDir).filter((f) => f.endsWith('.scss'))
  }
  return { dir, relative, isProperties, scssFiles }
}
