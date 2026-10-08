/**
 * Types for the SRL project configuration (`srl.config.ts` / `srl.config.json`).
 *
 * The sections mirror SRL 1 `srl.config.json`. Every section becomes one
 * `@use "@simple-reporting/core/scss/<section>/variables.scss" with (...)`
 * block in the generated `config.scss`, so each key of a section is a Sass
 * variable of that module. The types are deliberately permissive: known keys
 * get autocompletion, unknown keys are still accepted because SCSS modules
 * can read arbitrary map keys.
 */

/** Any value that can be turned into a Sass value by the token generator. */
export type SrlScssValue =
  | string
  | number
  | boolean
  | null
  | SrlScssValue[]
  | { [key: string]: SrlScssValue }

/** A Sass map. */
export type SrlScssMap = { [key: string]: SrlScssValue }

/** Responsive overrides used by typography, spacer and grid entries. */
export interface SrlMediaOverrides<T> {
  /** Values used for print / PDF output. */
  print?: T
  /** Values applied from the breakpoint upwards. */
  up?: { [breakpoint: string]: T }
  /** Values applied from the breakpoint downwards. */
  down?: { [breakpoint: string]: T }
  /** Values applied only inside the breakpoint. */
  only?: { [breakpoint: string]: T }
  [key: string]: T | { [breakpoint: string]: T } | undefined
}

export interface SrlTypographyProperties {
  'font-family'?: string
  'font-size'?: number | string
  'line-height'?: number | string
  'font-style'?: string
  'font-weight'?: number | string
  'letter-spacing'?: number | string
  'text-transform'?: string
  /** Name of a colour from `colors.colors`. */
  color?: string
  'margin-top'?: number | string
  'margin-bottom'?: number | string
  [key: string]: unknown
}

export interface SrlTypographyEntry extends SrlTypographyProperties {
  /** Name of the typography mixin, e.g. `title-h1`. Required. */
  name: string
  media?: SrlMediaOverrides<SrlTypographyProperties>
}

export interface SrlColorEntry {
  /** Name of the colour function, e.g. `primary-1000`. Required. */
  name: string
  /** CSS colour value. */
  color: string
  [key: string]: SrlScssValue | undefined
}

export interface SrlSpacerEntry {
  size: number | string
  media?: SrlMediaOverrides<{ size?: number | string; [key: string]: SrlScssValue | undefined }>
  [key: string]: SrlScssValue | SrlMediaOverrides<any> | undefined
}

export interface SrlGridContainer {
  padding?: number | string
  'max-width'?: number | string
  [key: string]: SrlScssValue | undefined
}

export interface SrlGridGutter {
  'column-gap'?: number | string
  [key: string]: SrlScssValue | undefined
}

export interface SrlFontType {
  src?: { [format: string]: string }
  'font-weight'?: number | string
  'font-style'?: string
  'font-display'?: string
  [key: string]: SrlScssValue | undefined
}

export interface SrlFontDefinition {
  name?: string
  types?: SrlFontType[]
  [key: string]: unknown
}

export interface SrlConfigSections {
  /** Free-form design metadata (`meta.$meta`), read via `srl.get(...)`. */
  meta?: {
    meta?: SrlScssMap
    spacer?: SrlScssMap
    padding?: SrlScssMap
    [key: string]: SrlScssValue | undefined
  }
  typography?: {
    typography?: SrlTypographyEntry[]
    [key: string]: SrlScssValue | SrlTypographyEntry[] | undefined
  }
  colors?: {
    colors?: SrlColorEntry[]
    [key: string]: SrlScssValue | SrlColorEntry[] | undefined
  }
  spacer?: {
    /** Margins between components: `{ group: { <name>: { all: 200, <other>: 400 } } }`. */
    margins?: SrlScssMap
    /** Spacer sizes keyed by name, e.g. `{ "100": { size: 8 } }`. */
    spacer?: { [name: string]: SrlSpacerEntry }
    [key: string]: SrlScssValue | { [name: string]: SrlSpacerEntry } | undefined
  }
  grid?: {
    containers?: { [breakpoint: string]: SrlGridContainer }
    breakpoints?: { [breakpoint: string]: number }
    columns?: { [breakpoint: string]: number }
    gutter?: { [breakpoint: string]: SrlGridGutter }
    'column-default-span'?: number
    [key: string]: unknown
  }
  fonts?: {
    /** Folder with font definitions, relative to the project root. */
    'font-base-path'?: string
    'default-font'?: string
    /** Font definitions or names of folders below `font-base-path` that contain a `styles.json`. */
    fonts?: Array<string | SrlFontDefinition>
    [key: string]: SrlScssValue | Array<string | SrlFontDefinition> | undefined
  }
  /**
   * System variables. `build`, `size-unit` and `environment` are set per build
   * target by the token generator and override values given here.
   */
  system?: {
    environment?: string
    build?: string
    'size-unit'?: string
    dpi?: number
    point?: number
    'root-size'?: number
    'variable-prefix'?: string
    'class-prefix'?: string
    'root-styles'?: SrlScssMap
    [key: string]: SrlScssValue | undefined
  }
  helpers?: {
    'default-list-margin'?: number
    'default-list-padding'?: number
    [key: string]: SrlScssValue | undefined
  }
}

/** Project settings that are not design tokens. Ignored by the token generator. */
export interface SrlProjectConfig {
  livingdocs?: {
    /** npm package name of an alternative Livingdocs component source, or `null` for none. */
    alternative?: string | null
  }
  [key: string]: unknown
}

export interface SrlConfig extends SrlConfigSections {
  project?: SrlProjectConfig
}

/** Token sections in the order they are written to `config.scss`. */
export const SRL_TOKEN_SECTIONS = [
  'system',
  'fonts',
  'meta',
  'grid',
  'colors',
  'typography',
  'spacer',
  'helpers',
] as const

export type SrlTokenSection = (typeof SRL_TOKEN_SECTIONS)[number]
