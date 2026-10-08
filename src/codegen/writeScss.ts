/**
 * Writes the generated SCSS of one build target to disk:
 *
 * ```
 * <outDir>/<target>/config.scss       design tokens with the target's system values
 * <outDir>/<target>/colors.scss       colour functions
 * <outDir>/<target>/typography.scss   typography mixins
 * <outDir>/<target>/index.scss        `@use 'srl'` entry (placeholders + forwards)
 * <outDir>/<target>/{system,…}.scss   static module files (see stubs.ts)
 * <outDir>/<target>/fa/*.scss         Font Awesome helpers
 * <outDir>/entries/<target>.scss      the stylesheet entry of the target
 * <outDir>/entries/fonts.scss         remote font CSS of the hosted design
 * ```
 *
 * The Sass alias `srl` must point to `<outDir>/<target>` for the build of that
 * target (see {@link srlScssAliases}), so every target gets its own token
 * configuration without shared mutable state.
 * Files are only written when their content changed, so watchers are not
 * triggered needlessly.
 */
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { SrlConfig } from '../config/types'
import {
  renderIndexScss,
  renderScssEntries,
  resolveDesignBaseUrl,
  scanScssSources,
  type DesignInfo,
  type ScssSourceDirs,
  type ScssSources,
} from './scssEntries'
import { SRL_SCSS_STUBS } from './stubs'
import { renderTokens, systemValuesFor, type SrlBuildTarget, type SrlSystemValues } from './tokens'

export const DEFAULT_SRL_SCSS_OUT_DIR = '.srl/scss'

export type FontAwesomeType = 'free' | 'pro'

export interface WriteSrlScssOptions {
  rootDir: string
  /** Output folder, relative to `rootDir` or absolute. Default `.srl/scss`. */
  outDir?: string
  target: SrlBuildTarget
  config: SrlConfig
  /** Default: `production`. */
  environment?: SrlSystemValues['environment']
  /** Override the system values entirely (default: {@link systemValuesFor}). */
  system?: SrlSystemValues
  /** Source folders, see {@link DEFAULT_SCSS_SOURCE_DIRS}. */
  dirs?: ScssSourceDirs
  /**
   * Hosted design used for the remote font CSS. Defaults: base URL from
   * `SRL_EDITOR_DESIGN_URL` / `INTERNAL_LDD_URL`, name and version from the
   * project's `package.json`.
   */
  design?: Partial<DesignInfo>
  /** Pre-scanned sources (to share one scan between targets). */
  sources?: ScssSources
}

export interface WriteSrlScssResult {
  /** Absolute folder the `srl` alias must point to. */
  srlDir: string
  /** Absolute path of the target's entry stylesheet. */
  entry: string
  /** All files that belong to this target (absolute). */
  files: string[]
  /** Files whose content actually changed (absolute). */
  written: string[]
  warnings: string[]
}

/**
 * Generates and writes the SCSS of one target. Returns what was written.
 */
export async function writeSrlScss(options: WriteSrlScssOptions): Promise<WriteSrlScssResult> {
  const rootDir = path.resolve(options.rootDir)
  const outDir = path.resolve(rootDir, options.outDir ?? DEFAULT_SRL_SCSS_OUT_DIR)
  const { target } = options
  const srlDir = path.join(outDir, target)
  const entriesDir = path.join(outDir, 'entries')
  const system = options.system ?? systemValuesFor(target, options.environment)
  const sources = options.sources ?? scanScssSources(rootDir, options.dirs)

  const tokens = renderTokens(options.config, system, {
    readFontStyles: (basePath, font) =>
      JSON.parse(readFileSync(path.join(rootDir, basePath, font, 'styles.json'), 'utf8')),
  })

  const pkg = readPackageJson(rootDir)
  const design: DesignInfo = {
    baseUrl: options.design?.baseUrl ?? resolveDesignBaseUrl(process.env),
    name: options.design?.name ?? pkg.name ?? 'design',
    version: options.design?.version ?? pkg.version ?? '0.0.0',
  }
  const entries = renderScssEntries(sources, {
    entriesDir,
    tokensDir: (t) => path.join(outDir, t),
    design,
  })

  const files: Record<string, string> = {}
  for (const [name, content] of Object.entries(SRL_SCSS_STUBS)) {
    files[path.join(srlDir, name)] = content
  }
  files[path.join(srlDir, 'config.scss')] = tokens['config.scss']
  files[path.join(srlDir, 'colors.scss')] = tokens['colors.scss']
  files[path.join(srlDir, 'typography.scss')] = tokens['typography.scss']
  files[path.join(srlDir, 'index.scss')] = renderIndexScss(sources, { tokensDir: srlDir })
  const entry = path.join(entriesDir, `${target}.scss`)
  files[entry] = entries.files[`${target}.scss`]
  files[path.join(entriesDir, 'fonts.scss')] = entries.files['fonts.scss']

  const written: string[] = []
  for (const [file, content] of Object.entries(files)) {
    if (await writeIfChanged(file, content)) written.push(file)
  }

  return { srlDir, entry, files: Object.keys(files), written, warnings: entries.warnings }
}

/** Writes `content` to `file` unless it already has exactly that content. */
export async function writeIfChanged(file: string, content: string): Promise<boolean> {
  try {
    if ((await readFile(file, 'utf8')) === content) return false
  } catch {
    // missing → write
  }
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, content)
  return true
}

/** `pro` if `@fortawesome/fontawesome-pro` is installed in the project, else `free`. */
export function detectFontAwesomeType(rootDir: string): FontAwesomeType {
  return existsSync(path.join(rootDir, 'node_modules', '@fortawesome', 'fontawesome-pro'))
    ? 'pro'
    : 'free'
}

/**
 * Sass/Vite aliases for one target build (SRL 1 `viteSrlPlugin`):
 * `srl` → the target's module folder, `fa-source`/`fa-font` → Font Awesome
 * free or pro helpers inside it.
 */
export function srlScssAliases(
  srlDir: string,
  faType: FontAwesomeType = 'free',
): { srl: string; 'fa-source': string; 'fa-font': string } {
  return {
    srl: srlDir,
    'fa-source': path.join(srlDir, 'fa', `source-${faType}.scss`),
    'fa-font': path.join(srlDir, 'fa', `font-${faType}.scss`),
  }
}

function readPackageJson(rootDir: string): { name?: string; version?: string } {
  try {
    return JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'))
  } catch {
    return {}
  }
}
