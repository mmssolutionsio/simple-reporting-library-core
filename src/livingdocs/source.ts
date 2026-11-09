import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export type LivingdocsKind = 'component' | 'property'

/** A component (or property) folder in a livingdocs tree: <NNN.Group>/<NNN.component>/ */
export interface LivingdocsEntry {
  /** Identity across sources: kind + folder name without numeric prefix, e.g. "component:title-h1". */
  key: string
  kind: LivingdocsKind
  /** Group folder with prefix, e.g. "010.Titles". */
  group: string
  /** Component folder with prefix, e.g. "010.title-h1". */
  folder: string
  /** Absolute path of the component folder. */
  dir: string
  /** Package name, or "project" for the project's own livingdocs folder. */
  source: string
}

export interface LivingdocsSource {
  name: string
  /** Root of the component tree (contains the group folders). */
  dir: string
  /** "group/folder" paths installed into new projects. */
  defaults: string[]
}

export interface LivingdocsManifest {
  formatVersion: 1
  componentsDir?: string
  defaults?: string[]
}

const JUNK = /^(\.DS_Store|\.gitkeep|Thumbs\.db)$|:Zone\.Identifier$/

/** Strips the ordering prefix: "010.title-h1" -> "title-h1". */
export function stripPrefix(name: string): string {
  return name.replace(/^\d+\./, '')
}

/** Group label in the editor (same rules as SRL 1 lddGroupNames). */
export function formatGroupLabel(group: string): string {
  return stripPrefix(group).replace('_and_', ' / ').replaceAll('_', ' ')
}

export function entryKey(group: string, folder: string): string {
  const kind: LivingdocsKind = stripPrefix(group) === 'Properties' ? 'property' : 'component'
  return `${kind}:${stripPrefix(folder)}`
}

const isDir = (path: string) => existsSync(path) && statSync(path).isDirectory()
const sortedDirs = (dir: string) =>
  readdirSync(dir)
    .filter((name) => !JUNK.test(name) && isDir(join(dir, name)))
    .sort((a, b) => a.localeCompare(b, 'en'))

/** All component folders of a tree. Only folders count; loose files are ignored. */
export function indexTree(dir: string, source: string): LivingdocsEntry[] {
  if (!isDir(dir)) return []
  const entries: LivingdocsEntry[] = []
  for (const group of sortedDirs(dir)) {
    for (const folder of sortedDirs(join(dir, group))) {
      const key = entryKey(group, folder)
      entries.push({ key, kind: key.startsWith('property:') ? 'property' : 'component', group, folder, dir: join(dir, group, folder), source })
    }
  }
  return entries
}

/** Reads a livingdocs package (srl-livingdocs.json + components/). */
export function loadSource(packageDir: string, name: string): LivingdocsSource {
  const manifestFile = join(packageDir, 'srl-livingdocs.json')
  if (!existsSync(manifestFile)) {
    throw new Error(`${name} is not a livingdocs package (srl-livingdocs.json missing in ${packageDir}).`)
  }
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as LivingdocsManifest
  if (manifest.formatVersion !== 1) {
    throw new Error(`${name}: unsupported livingdocs format version ${manifest.formatVersion}.`)
  }
  return { name, dir: join(packageDir, manifest.componentsDir ?? 'components'), defaults: manifest.defaults ?? [] }
}
