import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { consola } from 'consola'
import { loadFile, writeFile } from 'magicast'
import type { LivingdocsSource } from '../livingdocs/source'
import { loadSource } from '../livingdocs/source'

export const STANDARD_LIVINGDOCS = '@simple-reporting/livingdocs'
export const logger = consola.withTag('srl')

/** Project root: nearest folder with a package.json, starting at cwd. */
export function projectRoot(cwd = process.cwd()): string {
  let dir = resolve(cwd)
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`No package.json found in ${cwd} or its parents.`)
    dir = parent
  }
  return dir
}

export function isInteractive(): boolean {
  return !!process.stdin.isTTY && !!process.stdout.isTTY && !process.env.CI
}

export function readPackageJson(root: string): { name?: string; version?: string; [key: string]: unknown } {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
}

/** Folder of an installed package, resolved from the project. */
export function packageDir(root: string, name: string): string | undefined {
  try {
    return dirname(createRequire(join(root, 'package.json')).resolve(`${name}/package.json`))
  } catch {
    return undefined
  }
}

export function installedVersion(root: string, name: string): string | undefined {
  const dir = packageDir(root, name)
  return dir ? JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version : undefined
}

// ---- srl.config.ts / srl.config.json: project.livingdocs.alternative ----------------------

export function srlConfigFile(root: string): string | undefined {
  return ['srl.config.ts', 'srl.config.json'].map((f) => join(root, f)).find((f) => existsSync(f))
}

/** undefined = never chosen, null = explicitly none, string = package name. */
export async function readAlternative(root: string): Promise<string | null | undefined> {
  const file = srlConfigFile(root)
  if (!file) return undefined
  if (file.endsWith('.json')) {
    const config = JSON.parse(readFileSync(file, 'utf8'))
    return config.project?.livingdocs?.alternative
  }
  const mod = await loadFile(file)
  const config = mod.exports.default.$type === 'function-call' ? mod.exports.default.$args[0] : mod.exports.default
  const livingdocs = config?.project?.livingdocs
  if (!livingdocs) return undefined
  const value = livingdocs.alternative
  if (value !== undefined) return value
  // magicast reads a `null` literal as undefined: the key being present means "explicitly none"
  return Object.keys(livingdocs).includes('alternative') ? null : undefined
}

export async function writeAlternative(root: string, alternative: string | null): Promise<void> {
  const file = srlConfigFile(root) ?? join(root, 'srl.config.json')
  if (file.endsWith('.json')) {
    const config = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
    config.project ??= {}
    config.project.livingdocs ??= {}
    config.project.livingdocs.alternative = alternative
    writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`)
    return
  }
  const mod = await loadFile(file)
  const config = mod.exports.default.$type === 'function-call' ? mod.exports.default.$args[0] : mod.exports.default
  config.project ??= {}
  config.project.livingdocs ??= {}
  config.project.livingdocs.alternative = alternative
  await writeFile(mod, file)
}

/** Standard + optional alternative livingdocs package of the project. */
export async function livingdocsSources(root: string): Promise<{ standard: LivingdocsSource; alternative?: LivingdocsSource }> {
  const standardDir = packageDir(root, STANDARD_LIVINGDOCS)
  if (!standardDir) throw new Error(`${STANDARD_LIVINGDOCS} is not installed. Run npm install ${STANDARD_LIVINGDOCS}.`)
  const standard = loadSource(standardDir, STANDARD_LIVINGDOCS)
  const alternativeName = await readAlternative(root)
  if (!alternativeName) return { standard }
  const alternativeDir = packageDir(root, alternativeName)
  if (!alternativeDir) throw new Error(`Alternative livingdocs package ${alternativeName} is not installed. Run npm install ${alternativeName}.`)
  return { standard, alternative: loadSource(alternativeDir, alternativeName) }
}
