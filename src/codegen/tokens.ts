/**
 * Design tokens → SCSS. Pure port of SRL 1 `scripts/beaver.js`.
 *
 * Differences to SRL 1:
 * - No global state: the build system values are passed in (`system`), the
 *   input config is never mutated.
 * - Fonts given as folder names are resolved through `opts.readFontStyles`
 *   instead of reading from `process.cwd()`.
 * - The package path is `@simple-reporting/core/scss/...`.
 * - The `project` key (and any other unknown section) is ignored.
 */
import path from 'node:path/posix'
import colorPalette from '@kne/color-palette'
import { SRL_TOKEN_SECTIONS, type SrlConfig } from '../config/types'

export const SRL_SCSS_PACKAGE = '@simple-reporting/core/scss'

export type SrlBuildTarget = 'app' | 'editor' | 'pdf' | 'word' | 'xbrl'
export const SRL_BUILD_TARGETS: readonly SrlBuildTarget[] = ['app', 'editor', 'pdf', 'word', 'xbrl']

export interface SrlSystemValues {
  build: SrlBuildTarget
  /** `rem` for all targets except Word (`pt`). Omitted in SRL 1 dev mode. */
  'size-unit'?: 'rem' | 'pt'
  environment: 'development' | 'production'
}

/** Default system values per target as set by SRL 1 `build.js`. */
export function systemValuesFor(
  target: SrlBuildTarget,
  environment: SrlSystemValues['environment'] = 'production',
): SrlSystemValues {
  return { environment, build: target, 'size-unit': target === 'word' ? 'pt' : 'rem' }
}

export interface RenderTokensOptions {
  /**
   * Resolves a font given by folder name in `fonts.fonts` (SRL 1 read
   * `<font-base-path>/<font>/styles.json` relative to the project root).
   * Required only if the config contains such string entries.
   */
  readFontStyles?: (fontBasePath: string, font: string) => unknown
  /** Package path used in the generated `@use`/`@forward` rules. */
  scssPackage?: string
}

export interface RenderedTokens {
  'config.scss': string
  'colors.scss': string
  'typography.scss': string
}

type Mapped = string | number | boolean | null | Mapped[] | { [key: string]: Mapped }

const SHADE_STEPS: Array<[string, number]> = [
  ['shade-50', 0.5],
  ['shade-100', 1],
  ['shade-200', 2],
  ['shade-300', 3],
  ['shade-400', 4],
  ['shade-500', 5],
  ['shade-600', 6],
  ['shade-700', 7],
  ['shade-800', 8],
  ['shade-900', 9],
  ['shade-950', 9.5],
]

/**
 * Renders `config.scss`, `colors.scss` and `typography.scss` for one build.
 */
export function renderTokens(
  config: SrlConfig,
  system: SrlSystemValues,
  opts: RenderTokensOptions = {},
): RenderedTokens {
  const pkg = opts.scssPackage ?? SRL_SCSS_PACKAGE
  const assigned = structuredClone(config) as Record<string, any>
  delete assigned.project

  // SRL 1: deepAssign(configJson, buildVariables) – system values win.
  const sys: Record<string, unknown> =
    assigned.system && typeof assigned.system === 'object' && !Array.isArray(assigned.system)
      ? assigned.system
      : {}
  sys.environment = system.environment
  sys.build = system.build
  if (system['size-unit'] !== undefined) sys['size-unit'] = system['size-unit']
  assigned.system = sys

  if (assigned.fonts !== undefined && assigned.fonts !== null) {
    const fontBasePath: string = assigned.fonts['font-base-path'] ?? ''
    if (fontBasePath.length) {
      assigned.fonts['font-base-path'] = '.' + path.normalize(fontBasePath)
    }
    if (Array.isArray(assigned.fonts.fonts)) {
      assigned.fonts.fonts = assigned.fonts.fonts.map((font: unknown) => {
        if (typeof font !== 'string') return font
        if (!opts.readFontStyles) {
          throw new Error(
            `fonts.fonts contains the folder name "${font}" but no readFontStyles() was given`,
          )
        }
        return opts.readFontStyles(fontBasePath, font)
      })
    }
  }

  const map: Record<string, Record<string, Mapped>> = {}
  for (const file of SRL_TOKEN_SECTIONS) {
    const section = assigned[file]
    if (section === undefined) continue
    map[file] = {}
    for (const variable in section) {
      map[file][variable] = mapValues(section[variable])
    }
  }

  const colors = (map.colors?.colors ?? undefined) as Record<string, any> | undefined
  if (colors && !Array.isArray(colors) && typeof colors === 'object' && colors.shade) {
    const shade = colors.shade.color
    for (const [name, step] of SHADE_STEPS) {
      if (!colors[name]) {
        colors[name] = { color: colorPalette(shade, step) }
      }
    }
  }

  const blocks: string[] = []
  for (const file of SRL_TOKEN_SECTIONS) {
    const section = map[file]
    if (section === undefined) continue
    const o: string[] = []
    o.push(`@use "${pkg}/${file}/variables.scss" as ${file}Variables with (`)
    const v: string[] = []
    for (const variable in section) {
      v.push(`  $${variable}: ${makeScssVariables(section[variable]!)}`)
    }
    o.push(v.join(`,\n`))
    o.push(');\n')
    blocks.push(o.join(`\n`))
  }

  return {
    'config.scss': blocks.join(`\n`),
    'colors.scss': writeColorsScss(map.colors, pkg),
    'typography.scss': writeTypographyScss(map.typography, pkg),
  }
}

/** Arrays of `{ name, ... }` become maps keyed by name; `""` becomes `""` literally. */
function mapValues(values: unknown): Mapped {
  if (Array.isArray(values)) {
    let r: Record<string, Mapped> | Mapped[] = {}
    for (const item of values) {
      const name = item !== null && typeof item === 'object' ? (item as any).name : undefined
      if (name === undefined) {
        // Same as SRL 1: switching to list mode drops earlier named entries.
        if (!Array.isArray(r)) r = []
        r.push(mapValues(item))
      } else {
        // On a list this sets a named property, which SRL 1 printed as `var<name>`.
        ;(r as any)[name] = mapValues(item)
      }
    }
    return r
  }
  if (values !== null && typeof values === 'object') {
    const r: Record<string, Mapped> = {}
    for (const label in values) {
      if (label !== 'name') r[label] = mapValues((values as any)[label])
    }
    return r
  }
  if (values === null) {
    // SRL 1: typeof null === 'object' → empty map.
    return {}
  }
  if (values === '') return `""`
  return values as Mapped
}

function hasOutsideOfParentheses(text: string, needle: string): boolean {
  let depth = 0
  for (const char of text) {
    if (char === '(') depth++
    else if (char === ')') depth--
    else if (char === needle && depth === 0) return true
  }
  return false
}

const UNIT_SIZE = /^-?\d*\.?\d+(px|em|rem|%|vw|vh|vmin|vmax|cm|mm|in|pt|pc|ex|ch)?$/

function makeScssVariables(values: Mapped, indent = 2): string {
  if (values !== null && typeof values === 'object') {
    const r: string[] = ['(']
    const v: string[] = []
    const isArray = Array.isArray(values)
    for (const key in values) {
      const value = (values as any)[key] as Mapped
      v.push(
        `${' '.repeat(indent + 2)}${isArray ? `var${key}` : key}: ${makeScssVariables(value, indent + 2)}`,
      )
    }
    r.push(v.join(`,\n`))
    r.push(`${' '.repeat(indent)})`)
    return r.join(`\n`)
  }
  if (
    typeof values === 'string' &&
    values !== `""` &&
    !UNIT_SIZE.test(values) &&
    (hasOutsideOfParentheses(values, '.') || hasOutsideOfParentheses(values, ','))
  ) {
    return `"${values.replaceAll('"', '\\"')}"`
  }
  return String(values)
}

function writeTypographyScss(typography: Record<string, Mapped> | undefined, pkg: string): string {
  const r = [`@use "config";`, `@forward "${pkg}/typography";`]
  const list = typography?.typography
  if (list && typeof list === 'object') {
    const o: string[] = []
    for (const typo in list) {
      o.push(`@mixin ${typo}($margins: false) {`)
      o.push(`  @include typography.get("${typo}", $margins);`)
      o.push(`}\n`)
    }
    if (o.length) {
      r.push(`@use "${pkg}/typography";\n`)
      r.push(o.join(`\n`))
    }
  }
  return r.join(`\n`)
}

function writeColorsScss(colors: Record<string, Mapped> | undefined, pkg: string): string {
  const r = [`@use "config";`, `@forward "${pkg}/colors";`]
  const list = colors?.colors
  if (list && typeof list === 'object') {
    const o: string[] = []
    for (const color in list) {
      o.push(`@function ${color}() {`)
      o.push(`  @return colors.get("${color}");`)
      o.push(`}\n`)
    }
    if (o.length) {
      r.push(`@use "${pkg}/colors";\n`)
      r.push(o.join(`\n`))
    }
  }
  return r.join(`\n`)
}
