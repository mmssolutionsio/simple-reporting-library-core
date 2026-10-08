import { existsSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadConfig } from 'c12'
import type { SrlConfig } from './types'
import { normalizeSrlConfig } from './validate'

/** Script variants of `srl.config.*` that take precedence over the JSON file. */
export const SRL_CONFIG_SCRIPT_FILES = [
  'srl.config.ts',
  'srl.config.mts',
  'srl.config.js',
  'srl.config.mjs',
] as const
export const SRL_CONFIG_JSON_FILE = 'srl.config.json'

export interface LoadSrlConfigOptions {
  /** Called for every warning. Defaults to `console.warn` with an `[srl]` prefix. */
  warn?: (message: string) => void
  /** Throw if no config file exists. Default: `false` (an empty config is returned). */
  required?: boolean
}

export interface LoadedSrlConfig {
  config: SrlConfig
  /** Absolute path of the loaded file, or `undefined` if none exists. */
  configFile: string | undefined
  /** All files that should be watched for changes (whether they exist or not). */
  watchFiles: string[]
  warnings: string[]
}

/**
 * Lists the config files present in `rootDir`.
 */
export function findSrlConfigFiles(rootDir: string): { script?: string; json?: string } {
  const script = SRL_CONFIG_SCRIPT_FILES.map((f) => join(rootDir, f)).find((f) => existsSync(f))
  const json = join(rootDir, SRL_CONFIG_JSON_FILE)
  return { script, json: existsSync(json) ? json : undefined }
}

/**
 * Loads `srl.config.ts` (or `.mts/.js/.mjs`) via c12, falling back to
 * `srl.config.json`. If both a script and the JSON file exist, the script wins
 * and a warning is emitted. The result is normalised and validated.
 */
export async function loadSrlConfig(
  rootDir: string,
  options: LoadSrlConfigOptions = {},
): Promise<LoadedSrlConfig> {
  const warn = options.warn ?? ((m: string) => console.warn(`[srl] ${m}`))
  const warnings: string[] = []
  const report = (m: string) => {
    warnings.push(m)
    warn(m)
  }

  const watchFiles = [...SRL_CONFIG_SCRIPT_FILES, SRL_CONFIG_JSON_FILE].map((f) => join(rootDir, f))
  const found = findSrlConfigFiles(rootDir)
  const file = found.script ?? found.json

  if (found.script && found.json) {
    report(
      `both ${relativeName(found.script)} and ${SRL_CONFIG_JSON_FILE} exist; ` +
        `${relativeName(found.script)} is used, ${SRL_CONFIG_JSON_FILE} is ignored. Delete one of them.`,
    )
  }

  if (!file) {
    if (options.required) {
      throw new Error(`No srl.config.ts or srl.config.json found in ${rootDir}`)
    }
    return { config: {}, configFile: undefined, watchFiles, warnings }
  }

  const result = await loadConfig<Record<string, unknown>>({
    name: 'srl',
    cwd: rootDir,
    // Pass the exact file name so c12 loads the file we picked (and warned about).
    configFile: relativeName(file),
    // Only the project's own file: no rc files, no package.json key, no .env,
    // no `$development`-style overrides and no `extends` layers.
    rcFile: false,
    globalRc: false,
    packageJson: false,
    dotenv: false,
    envName: false,
    extend: false,
  })

  const configFile = result.configFile ?? file

  const { config, warnings: validationWarnings } = normalizeSrlConfig(
    result.config,
    relativeName(configFile),
  )
  validationWarnings.forEach(report)

  return { config, configFile, watchFiles, warnings }
}

/**
 * Writes `srl.config.ts` with the content of `srl.config.json`
 * (`export default defineSrlConfig(<json>)`). The JSON file is left in place
 * unless `removeJson` is set. Fails if `srl.config.ts` already exists.
 */
export async function migrateJsonConfig(
  rootDir: string,
  options: { removeJson?: boolean; importFrom?: string } = {},
): Promise<{ file: string; source: string }> {
  const jsonFile = join(rootDir, SRL_CONFIG_JSON_FILE)
  const tsFile = join(rootDir, 'srl.config.ts')
  if (!existsSync(jsonFile)) {
    throw new Error(`${jsonFile} does not exist`)
  }
  if (existsSync(tsFile)) {
    throw new Error(`${tsFile} already exists`)
  }
  const raw = JSON.parse(await readFile(jsonFile, 'utf8'))
  const { config } = normalizeSrlConfig(raw, SRL_CONFIG_JSON_FILE)
  const source = renderSrlConfigTs(config, options.importFrom)
  await writeFile(tsFile, source)
  if (options.removeJson) {
    await rm(jsonFile)
  }
  return { file: tsFile, source }
}

/** Source of an `srl.config.ts` for the given config. */
export function renderSrlConfigTs(
  config: SrlConfig,
  importFrom = '@simple-reporting/core/config',
): string {
  return (
    `import { defineSrlConfig } from '${importFrom}'\n\n` +
    `export default defineSrlConfig(${JSON.stringify(config, null, 2)})\n`
  )
}

function relativeName(file: string): string {
  return file.split(/[\\/]/).pop() ?? file
}
