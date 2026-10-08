import { join } from 'node:path'
import { indexTree, stripPrefix, type LivingdocsEntry, type LivingdocsSource } from './source'

export interface InstallItem {
  key: string
  from: LivingdocsEntry
  /** Target folder relative to the project livingdocs folder: "<group>/<folder>". */
  to: string
}

export interface InstallPlan {
  /** Components available from standard + alternative and not yet in the project. */
  offered: LivingdocsEntry[]
  /** Components to copy (mode "defaults" or the selected keys). */
  install: InstallItem[]
  /** Requested keys that are already in the project or unknown. */
  skipped: { key: string; reason: 'installed' | 'unknown' }[]
}

export interface PlanInstallOptions {
  standard: LivingdocsSource
  alternative?: LivingdocsSource
  /** Project livingdocs folder. */
  projectDir: string
  /** "defaults": install the defaults of both packages; "select": install `keys`. */
  mode: 'defaults' | 'select'
  keys?: string[]
}

/**
 * Merges standard and alternative package and decides what to copy into the project:
 * - the alternative overrides components with the same key (name without numeric prefix) and adds new ones
 * - a component that exists in the project (any group/prefix) is never offered or touched again
 * - target group: an existing project group with the same name (ignoring prefix), else the source group
 */
export function planInstall(options: PlanInstallOptions): InstallPlan {
  const available = new Map<string, LivingdocsEntry>()
  const standardEntries = indexTree(options.standard.dir, options.standard.name)
  const alternativeEntries = options.alternative ? indexTree(options.alternative.dir, options.alternative.name) : []
  for (const entry of [...standardEntries, ...alternativeEntries]) available.set(entry.key, entry)

  const project = indexTree(options.projectDir, 'project')
  const installed = new Set(project.map((entry) => entry.key))
  const projectGroups = new Map(project.map((entry) => [stripPrefix(entry.group), entry.group]))

  const offered = [...available.values()].filter((entry) => !installed.has(entry.key))

  let requested: string[]
  if (options.mode === 'defaults') {
    const keyOf = (entries: LivingdocsEntry[], path: string) => entries.find((e) => `${e.group}/${e.folder}` === path)?.key
    requested = [
      ...options.standard.defaults.map((path) => keyOf(standardEntries, path) ?? `unknown:${path}`),
      ...(options.alternative?.defaults ?? []).map((path) => keyOf(alternativeEntries, path) ?? `unknown:${path}`),
    ]
  } else {
    requested = options.keys ?? []
  }

  const plan: InstallPlan = { offered, install: [], skipped: [] }
  for (const key of new Set(requested)) {
    const entry = available.get(key)
    if (!entry) plan.skipped.push({ key, reason: 'unknown' })
    else if (installed.has(key)) plan.skipped.push({ key, reason: 'installed' })
    else {
      const group = projectGroups.get(stripPrefix(entry.group)) ?? entry.group
      plan.install.push({ key, from: entry, to: join(group, entry.folder) })
    }
  }
  return plan
}
