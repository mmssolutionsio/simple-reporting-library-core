import { existsSync } from 'node:fs'
import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { InstallPlan } from './planInstall'
import { indexTree } from './source'

const JUNK = /(^|\/)(\.DS_Store|Thumbs\.db)$|:Zone\.Identifier$/

/** Copies the planned components into the project. Never overwrites an existing folder. */
export async function applyPlan(plan: InstallPlan, projectDir: string, { dryRun = false } = {}): Promise<string[]> {
  const copied: string[] = []
  for (const item of plan.install) {
    const target = join(projectDir, item.to)
    if (existsSync(target)) continue
    copied.push(item.to)
    if (dryRun) continue
    await mkdir(dirname(target), { recursive: true })
    await cp(item.from.dir, target, { recursive: true, errorOnExist: true, force: false, filter: (src) => !JUNK.test(src) })
  }
  return copied
}

/** Removes components (by key) from the project; resolves after all folders are gone. */
export async function removeComponents(projectDir: string, keys: string[], { dryRun = false } = {}): Promise<string[]> {
  const wanted = new Set(keys)
  const targets = indexTree(projectDir, 'project').filter((entry) => wanted.has(entry.key))
  if (!dryRun) await Promise.all(targets.map((entry) => rm(entry.dir, { recursive: true, force: true })))
  return targets.map((entry) => `${entry.group}/${entry.folder}`)
}
