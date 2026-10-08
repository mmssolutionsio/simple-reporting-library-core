import { join } from 'node:path'
import * as p from '@clack/prompts'
import { defineCommand } from 'citty'
import { applyPlan, removeComponents } from '../../livingdocs/applyPlan'
import { planInstall } from '../../livingdocs/planInstall'
import { createComponent, createGroup, parseComponentPath } from '../../livingdocs/create'
import { formatGroupLabel, indexTree, stripPrefix, type LivingdocsEntry } from '../../livingdocs/source'
import { isInteractive, livingdocsSources, logger, projectRoot, writeAlternative } from '../context'

const kindArg = { type: 'positional', description: 'components | groups', required: true } as const
const label = (entry: LivingdocsEntry) =>
  `${formatGroupLabel(entry.group)} / ${stripPrefix(entry.folder)}${entry.source === 'project' ? '' : `  (${entry.source})`}`

function cancelled(value: unknown): value is symbol {
  if (p.isCancel(value)) {
    p.cancel('Cancelled.')
    return true
  }
  return false
}

export const add = defineCommand({
  meta: { name: 'add', description: 'Copy components or groups from the livingdocs packages into the project' },
  args: {
    kind: kindArg,
    keys: { type: 'string', description: 'Comma separated keys (component:<name>, property:<name>) or group names instead of the prompt' },
    'dry-run': { type: 'boolean', description: 'Only show what would be copied' },
  },
  async run({ args }) {
    const root = projectRoot()
    const projectDir = join(root, 'livingdocs')
    const sources = await livingdocsSources(root)
    const offered = planInstall({ ...sources, projectDir, mode: 'select' }).offered
    if (!offered.length) return logger.info('All components of the livingdocs packages are already in the project.')

    let keys: string[]
    if (args.keys) {
      const wanted = args.keys.split(',').map((k) => k.trim())
      keys = args.kind === 'groups' ? offered.filter((e) => wanted.includes(stripPrefix(e.group))).map((e) => e.key) : wanted
    } else if (!isInteractive()) {
      throw new Error('No terminal for the prompt: pass --keys.')
    } else if (args.kind === 'groups') {
      const groups = [...new Set(offered.map((e) => stripPrefix(e.group)))]
      const picked = await p.multiselect({ message: 'Groups to add', options: groups.map((g) => ({ value: g, label: formatGroupLabel(g) })) })
      if (cancelled(picked)) return
      keys = offered.filter((e) => picked.includes(stripPrefix(e.group))).map((e) => e.key)
    } else {
      const picked = await p.multiselect({ message: 'Components to add', options: offered.map((e) => ({ value: e.key, label: label(e) })) })
      if (cancelled(picked)) return
      keys = picked
    }

    const plan = planInstall({ ...sources, projectDir, mode: 'select', keys })
    for (const skipped of plan.skipped) logger.warn(`${skipped.key}: ${skipped.reason}`)
    const copied = await applyPlan(plan, projectDir, { dryRun: args['dry-run'] })
    for (const path of copied) logger.success(`${args['dry-run'] ? 'would copy' : 'copied'} livingdocs/${path}`)
  },
})

export const remove = defineCommand({
  meta: { name: 'remove', description: 'Remove components or groups from the project' },
  args: {
    kind: kindArg,
    keys: { type: 'string', description: 'Comma separated keys or group names instead of the prompt' },
    yes: { type: 'boolean', description: 'Do not ask for confirmation' },
  },
  async run({ args }) {
    const projectDir = join(projectRoot(), 'livingdocs')
    const installed = indexTree(projectDir, 'project')
    let keys: string[]
    if (args.keys) {
      const wanted = args.keys.split(',').map((k) => k.trim())
      keys = args.kind === 'groups' ? installed.filter((e) => wanted.includes(stripPrefix(e.group))).map((e) => e.key) : wanted
    } else if (!isInteractive()) {
      throw new Error('No terminal for the prompt: pass --keys.')
    } else {
      const options =
        args.kind === 'groups'
          ? [...new Set(installed.map((e) => e.group))].map((g) => ({ value: g, label: formatGroupLabel(g) }))
          : installed.map((e) => ({ value: e.key, label: label(e) }))
      const picked = await p.multiselect({ message: `${args.kind === 'groups' ? 'Groups' : 'Components'} to remove`, options })
      if (cancelled(picked)) return
      keys = args.kind === 'groups' ? installed.filter((e) => picked.includes(e.group)).map((e) => e.key) : picked
    }
    if (!keys.length) return
    if (!args.yes && isInteractive()) {
      const ok = await p.confirm({ message: `Delete ${keys.length} folder(s) from livingdocs/?` })
      if (cancelled(ok) || !ok) return
    }
    for (const path of await removeComponents(projectDir, keys)) logger.success(`removed livingdocs/${path}`)
  },
})

export const create = defineCommand({
  meta: { name: 'create', description: 'Scaffold a new component or group in livingdocs/' },
  args: {
    kind: { type: 'positional', description: 'component | group', required: true },
    name: { type: 'positional', description: '<NNN.Group>/<NNN.name> or <NNN.Group>', required: false },
  },
  async run({ args }) {
    const projectDir = join(projectRoot(), 'livingdocs')
    let name = args.name
    if (!name) {
      if (!isInteractive()) throw new Error('Pass the name as argument.')
      const answer = await p.text({ message: args.kind === 'group' ? 'Group name (e.g. 200.Teaser)' : 'Component (e.g. 200.Teaser/010.teaser)' })
      if (cancelled(answer)) return
      name = answer
    }
    if (args.kind === 'group') {
      logger.success(`created ${await createGroup(projectDir, name)}`)
      return
    }
    const { group, name: folder } = parseComponentPath(name)
    if (!group) throw new Error('Use <group>/<component>, e.g. 200.Teaser/010.teaser.')
    logger.success(`created ${await createComponent(projectDir, group, folder)}`)
  },
})

export const source = defineCommand({
  meta: { name: 'source', description: 'Set the alternative livingdocs package (or "none")' },
  args: { package: { type: 'positional', description: 'npm package name or "none"', required: true } },
  async run({ args }) {
    const root = projectRoot()
    const value = args.package === 'none' ? null : args.package
    await writeAlternative(root, value)
    logger.success(value ? `Alternative livingdocs package: ${value} (install it with npm install ${value})` : 'No alternative livingdocs package.')
  },
})

export default defineCommand({
  meta: { name: 'livingdocs', description: 'Manage the livingdocs component sources' },
  subCommands: { source },
})
