import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import * as p from '@clack/prompts'
import { defineCommand } from 'citty'
import { unzipSync } from 'fflate'
import { checkDataVersions } from '../../shared/dataVersion'
import { isInteractive, logger, projectRoot } from '../context'

export const DATA_FOLDERS = ['json', 'html', 'images', 'downloads'] as const

/** Folder that contains json/settings.json (the downloaded preview may be nested). */
export function findDataRoot(dir: string, depth = 3): string | undefined {
  if (existsSync(join(dir, 'json/settings.json'))) return dir
  if (depth === 0) return undefined
  for (const name of readdirSync(dir)) {
    const child = join(dir, name)
    if (statSync(child).isDirectory() && !name.startsWith('.') && name !== 'node_modules') {
      const found = findDataRoot(child, depth - 1)
      if (found) return found
    }
  }
  return undefined
}

async function extractZip(file: string): Promise<string> {
  const target = await mkdtemp(join(tmpdir(), 'srl-data-'))
  const entries = unzipSync(new Uint8Array(readFileSync(file)))
  for (const [name, content] of Object.entries(entries)) {
    if (name.endsWith('/') || name.includes('..')) continue
    const out = join(target, name)
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, content)
  }
  return target
}

export const importData = defineCommand({
  meta: { name: 'import', description: 'Copy json/, html/, images/ and downloads/ from a downloaded nswow preview (zip or folder) to data/' },
  args: {
    source: { type: 'positional', description: 'zip file or folder', required: true },
    yes: { type: 'boolean', description: 'Replace data/ without asking' },
  },
  async run({ args }) {
    const root = projectRoot()
    const input = resolve(args.source)
    if (!existsSync(input)) throw new Error(`${input} does not exist.`)
    const extracted = statSync(input).isDirectory() ? undefined : await extractZip(input)
    try {
      const from = findDataRoot(extracted ?? input)
      if (!from) throw new Error(`No json/settings.json found in ${args.source}.`)

      const dataDir = join(root, 'data')
      if (existsSync(dataDir) && !args.yes) {
        if (!isInteractive()) throw new Error('data/ exists: pass --yes to replace it.')
        const ok = await p.confirm({ message: 'Replace the current data/ folder?' })
        if (p.isCancel(ok) || !ok) return
      }
      await rm(dataDir, { recursive: true, force: true })
      for (const folder of DATA_FOLDERS) {
        if (existsSync(join(from, folder))) {
          await cp(join(from, folder), join(dataDir, folder), { recursive: true, filter: (src) => !src.endsWith(':Zone.Identifier') })
        }
      }
      logger.success(`Imported ${DATA_FOLDERS.filter((f) => existsSync(join(dataDir, f))).join(', ')} into data/`)
      warnDataVersions(dataDir)
    } finally {
      if (extracted) await rm(extracted, { recursive: true, force: true })
    }
  },
})

/** Warns when nswow delivers a data format this release does not know. */
export function warnDataVersions(dataDir: string): boolean {
  const files: Record<string, { version?: string } | undefined> = {}
  const json = join(dataDir, 'json')
  if (!existsSync(json)) return true
  for (const name of readdirSync(json)) {
    if (/^(settings|routing_[a-z-]+)\.json$/i.test(name)) files[`json/${name}`] = JSON.parse(readFileSync(join(json, name), 'utf8'))
  }
  const issues = checkDataVersions(files)
  for (const issue of issues) {
    logger.warn(`${issue.file} has data version ${issue.version}, which this @simple-reporting/core does not know. Update with: npx srl update`)
  }
  return issues.length === 0
}

export default defineCommand({
  meta: { name: 'data', description: 'Manage the nswow content data in data/' },
  subCommands: { import: importData },
})
