import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createJiti } from 'jiti'
import type { SrlHtmlComponent } from '../htmlComponents'
import { formatGroupLabel, stripPrefix } from './source'

/** Keys of the design that are generated and must not be maintained in livingdocs.config.json. */
export const GENERATED_DESIGN_KEYS = ['name', 'version', 'assets', 'groups', 'components', 'componentProperties'] as const

export interface LivingdocsComponent {
  name: string
  label?: string
  html: string
  properties?: string[]
  directives?: Record<string, { allowedChildren?: string[]; defaultContent?: { component: string }[]; [key: string]: unknown }>
  allowedParents?: string[]
  [key: string]: unknown
}

export interface LivingdocsDesign {
  name: string
  version: string
  assets: { css: string[]; js: string[]; [key: string]: unknown }
  groups: { label: string; components: string[] }[]
  components: LivingdocsComponent[]
  componentProperties: Record<string, unknown>
  [key: string]: unknown
}

export interface EditorDesignOptions {
  /** Project livingdocs folder. */
  livingdocsDir: string
  /** Hand-maintained part (livingdocs.config.json). */
  baseConfig: Record<string, unknown>
  name: string
  version: string
  assets?: { css?: string[]; js?: string[] }
}

export interface EditorDesignResult {
  design: LivingdocsDesign
  warnings: string[]
}

const listDirs = (dir: string) =>
  readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort((a, b) => a.localeCompare(b, 'en'))
const listFiles = (dir: string, pattern: RegExp) =>
  readdirSync(dir)
    .filter((name) => pattern.test(name) && statSync(join(dir, name)).isFile())
    .sort()

/** Same whitespace minification as SRL 1 mapLdd. */
export function minifyComponentHtml(html: string): string {
  return html.replaceAll(/>\s+/g, '>').replaceAll(/\s+</g, '<').trim()
}

/**
 * Builds the complete Livingdocs design (design.json) in memory from the project's livingdocs
 * folder and the hand-maintained livingdocs.config.json. The source file is never written.
 * Port of SRL 1 scripts/ldd/mapLdd.js.
 */
export async function buildEditorDesign(options: EditorDesignOptions): Promise<EditorDesignResult> {
  const warnings: string[] = []
  const { livingdocsDir } = options
  const groups: LivingdocsDesign['groups'] = []
  const components: LivingdocsComponent[] = []

  for (const generated of GENERATED_DESIGN_KEYS) {
    if (generated in options.baseConfig && generated !== 'assets') {
      warnings.push(`livingdocs.config.json contains the generated key "${generated}"; it is ignored.`)
    }
  }

  const groupFolders = existsSync(livingdocsDir) ? listDirs(livingdocsDir) : []
  for (const group of groupFolders) {
    const groupComponents: string[] = []
    for (const folder of listDirs(join(livingdocsDir, group))) {
      const dir = join(livingdocsDir, group, folder)
      const html = listFiles(dir, /\.html$/)[0]
      if (!html || !existsSync(join(dir, 'ld-conf.json'))) continue
      groupComponents.push(stripPrefix(folder))
      const conf = JSON.parse(readFileSync(join(dir, 'ld-conf.json'), 'utf8'))
      components.push({ ...conf, html: minifyComponentHtml(readFileSync(join(dir, html), 'utf8')) })
    }
    groups.push({ label: formatGroupLabel(group), components: groupComponents })
  }

  const componentProperties: Record<string, unknown> = {}
  const propertySource: Record<string, string> = {}
  for (const file of findPropertyFiles(livingdocsDir)) {
    const properties = await loadProperties(file)
    for (const [key, value] of Object.entries(properties)) {
      if (key in componentProperties) {
        warnings.push(`Property "${key}" from ${file} overrides the one from ${propertySource[key]}.`)
      }
      componentProperties[key] = value
      propertySource[key] = file
    }
  }

  const { name: _n, version: _v, assets, groups: _g, components: _c, componentProperties: _p, ...manual } =
    options.baseConfig as Record<string, unknown> & { assets?: Record<string, unknown> }
  const design: LivingdocsDesign = {
    name: options.name,
    version: options.version,
    ...manual,
    assets: { ...assets, css: options.assets?.css ?? [], js: options.assets?.js ?? [] },
    groups,
    components,
    componentProperties,
  }
  return { design, warnings }
}

function findPropertyFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const found: string[] = []
  const walk = (current: string) => {
    for (const name of readdirSync(current).sort()) {
      const full = join(current, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/^properties\.(json|js|ts)$/.test(name)) found.push(full)
    }
  }
  walk(dir)
  return found
}

let jiti: ReturnType<typeof createJiti> | undefined
async function loadProperties(file: string): Promise<Record<string, unknown>> {
  if (file.endsWith('.json')) return JSON.parse(readFileSync(file, 'utf8'))
  jiti ??= createJiti(import.meta.url, { moduleCache: false })
  return (await jiti.import(file, { default: true })) as Record<string, unknown>
}

const upperCamel = (value: string) =>
  value
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
const hyphenate = (value: string) => value.replace(/\B([A-Z])/g, '-$1').toLowerCase()

/**
 * Vue files directly in a component folder become `SrlLd<Name>` components, used in the
 * nswow HTML as `<srl-ld-<name>>` (same naming as SRL 1).
 */
export function livingdocsVueComponents(livingdocsDir: string): (SrlHtmlComponent & { name: string })[] {
  if (!existsSync(livingdocsDir)) return []
  const result: (SrlHtmlComponent & { name: string })[] = []
  for (const group of listDirs(livingdocsDir)) {
    for (const folder of listDirs(join(livingdocsDir, group))) {
      for (const file of listFiles(join(livingdocsDir, group, folder), /\.vue$/)) {
        const name = `SrlLd${upperCamel(file.slice(0, -4))}`
        result.push({ name, tag: hyphenate(name), filePath: join(livingdocsDir, group, folder, file), priority: 10 })
      }
    }
  }
  return result
}
