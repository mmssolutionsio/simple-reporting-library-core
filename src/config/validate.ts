import { SRL_TOKEN_SECTIONS, type SrlConfig } from './types'

export class SrlConfigError extends Error {
  readonly issues: string[]
  constructor(issues: string[], source?: string) {
    super(
      `Invalid SRL config${source ? ` (${source})` : ''}:\n` +
        issues.map((i) => `  - ${i}`).join('\n'),
    )
    this.name = 'SrlConfigError'
    this.issues = issues
  }
}

export interface NormalizeResult {
  config: SrlConfig
  warnings: string[]
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const KNOWN_TOP_LEVEL = new Set<string>([...SRL_TOKEN_SECTIONS, 'project'])

/**
 * Normalises and validates a raw SRL config (from `srl.config.ts` or
 * `srl.config.json`). The input is not mutated.
 *
 * Normalisation: deep clone, a missing config becomes `{}`.
 * Validation is structural only; it reports all issues at once and throws a
 * {@link SrlConfigError}. Non-fatal findings are returned as warnings.
 */
export function normalizeSrlConfig(input: unknown, source?: string): NormalizeResult {
  const issues: string[] = []
  const warnings: string[] = []

  if (input === undefined || input === null) {
    return { config: {}, warnings }
  }
  if (!isPlainObject(input)) {
    throw new SrlConfigError([`the config must be an object, got ${describe(input)}`], source)
  }

  const config = structuredClone(input) as Record<string, unknown>

  for (const key of Object.keys(config)) {
    if (!KNOWN_TOP_LEVEL.has(key)) {
      warnings.push(`unknown section "${key}" is ignored`)
    }
  }

  for (const section of SRL_TOKEN_SECTIONS) {
    const value = config[section]
    if (value === undefined) continue
    if (!isPlainObject(value)) {
      issues.push(`"${section}" must be an object, got ${describe(value)}`)
    }
  }

  validateNamedList(config, 'typography', 'typography', issues, warnings, (entry, at) => {
    if (entry.media !== undefined && !isPlainObject(entry.media)) {
      issues.push(`${at}.media must be an object`)
    }
  })
  validateNamedList(config, 'colors', 'colors', issues, warnings, (entry, at) => {
    if (typeof entry.color !== 'string' || entry.color === '') {
      issues.push(`${at} ("${String(entry.name)}") needs a "color" string`)
    }
  })

  const spacer = config.spacer
  if (isPlainObject(spacer)) {
    for (const key of ['margins', 'spacer'] as const) {
      if (spacer[key] !== undefined && !isPlainObject(spacer[key])) {
        issues.push(`spacer.${key} must be an object`)
      }
    }
    if (isPlainObject(spacer.spacer)) {
      for (const [name, entry] of Object.entries(spacer.spacer)) {
        if (!isPlainObject(entry) || !('size' in entry)) {
          issues.push(`spacer.spacer["${name}"] needs a "size"`)
        }
      }
    }
  }

  const grid = config.grid
  if (isPlainObject(grid)) {
    for (const key of ['containers', 'breakpoints', 'columns', 'gutter'] as const) {
      if (grid[key] !== undefined && !isPlainObject(grid[key])) {
        issues.push(`grid.${key} must be an object keyed by breakpoint`)
      }
    }
  }

  const fonts = config.fonts
  if (isPlainObject(fonts)) {
    if (fonts['font-base-path'] !== undefined && typeof fonts['font-base-path'] !== 'string') {
      issues.push(`fonts["font-base-path"] must be a string`)
    }
    if (fonts.fonts !== undefined) {
      if (!Array.isArray(fonts.fonts)) {
        issues.push(`fonts.fonts must be an array`)
      } else {
        fonts.fonts.forEach((f, i) => {
          if (typeof f !== 'string' && !isPlainObject(f)) {
            issues.push(`fonts.fonts[${i}] must be a folder name or a font definition object`)
          }
        })
      }
    }
  }

  const project = config.project
  if (project !== undefined) {
    if (!isPlainObject(project)) {
      issues.push(`"project" must be an object`)
    } else if (project.livingdocs !== undefined) {
      if (!isPlainObject(project.livingdocs)) {
        issues.push(`project.livingdocs must be an object`)
      } else {
        const alt = project.livingdocs.alternative
        if (alt !== undefined && alt !== null && (typeof alt !== 'string' || alt === '')) {
          issues.push(`project.livingdocs.alternative must be a package name or null`)
        }
      }
    }
  }

  if (issues.length) {
    throw new SrlConfigError(issues, source)
  }
  return { config: config as SrlConfig, warnings }
}

function validateNamedList(
  config: Record<string, unknown>,
  section: string,
  key: string,
  issues: string[],
  warnings: string[],
  check: (entry: Record<string, unknown>, at: string) => void,
) {
  const sec = config[section]
  if (!isPlainObject(sec) || sec[key] === undefined) return
  const list = sec[key]
  if (!Array.isArray(list)) {
    issues.push(`${section}.${key} must be an array of entries with a "name"`)
    return
  }
  const seen = new Set<string>()
  list.forEach((entry, i) => {
    const at = `${section}.${key}[${i}]`
    if (!isPlainObject(entry)) {
      issues.push(`${at} must be an object`)
      return
    }
    if (typeof entry.name !== 'string' || entry.name.trim() === '') {
      issues.push(`${at} needs a non-empty "name"`)
      return
    }
    if (seen.has(entry.name)) {
      warnings.push(`${section}.${key}: duplicate name "${entry.name}", the last one wins`)
    }
    seen.add(entry.name)
    check(entry, at)
  })
}

function describe(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'an array'
  return typeof v
}
