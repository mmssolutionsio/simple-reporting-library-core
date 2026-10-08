import { execFileSync } from 'node:child_process'
import { defineCommand } from 'citty'
import { checkUpdates, type UpdateInfo } from '../../update/check'
import { STANDARD_LIVINGDOCS, installedVersion, logger, projectRoot, readAlternative } from '../context'

/** SRL packages of the project that are checked for updates. */
export async function srlPackages(root: string) {
  const names = ['@simple-reporting/core', STANDARD_LIVINGDOCS]
  const alternative = await readAlternative(root)
  if (alternative) names.push(alternative)
  return names.map((name) => ({ name, version: installedVersion(root, name) ?? '' })).filter((p) => p.version)
}

export function reportUpdates(updates: UpdateInfo[]) {
  for (const update of updates) {
    const message = `${update.name} ${update.current} → ${update.latest} (${update.type})`
    if (update.type === 'major') logger.warn(`${message}: read the changelog before updating (npx srl update).`)
    else logger.box(`Update available: ${message}\nRun: npx srl update`)
  }
}

/** Prints update notices; never throws (offline, timeouts). */
export async function notifyUpdates(root: string): Promise<UpdateInfo[]> {
  try {
    const updates = await checkUpdates(await srlPackages(root))
    reportUpdates(updates)
    return updates
  } catch {
    return []
  }
}

export default defineCommand({
  meta: { name: 'update', description: 'Check for and install updates of the SRL packages' },
  args: { check: { type: 'boolean', description: 'Only check, do not install' } },
  async run({ args }) {
    const root = projectRoot()
    const updates = await checkUpdates(await srlPackages(root))
    if (!updates.length) return logger.success('All SRL packages are up to date.')
    reportUpdates(updates)
    if (args.check) return
    execFileSync('npm', ['install', ...updates.map((u) => `${u.name}@${u.latest}`)], { cwd: root, stdio: 'inherit' })
    execFileSync('npx', ['nuxt', 'prepare'], { cwd: root, stdio: 'inherit' })
    logger.success('Updated. Restart the dev server.')
  },
})
