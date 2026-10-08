import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  defineSrlConfig,
  loadSrlConfig,
  migrateJsonConfig,
  normalizeSrlConfig,
  SrlConfigError,
  type SrlConfig,
} from '../src/config'

// Temp projects live inside the package so `@simple-reporting/core/config`
// resolves through the workspace's node_modules.
const tmpRoots: string[] = []
function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(__dirname, '.tmp-config-'))
  tmpRoots.push(dir)
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content)
  return dir
}
afterAll(() => tmpRoots.forEach((d) => rmSync(d, { recursive: true, force: true })))

const tsConfig = (color: string) => `import { defineSrlConfig } from '@simple-reporting/core/config'

export default defineSrlConfig({
  colors: { colors: [{ name: 'primary', color: '${color}' }] },
  project: { livingdocs: { alternative: '@acme/livingdocs' } },
})
`
const jsonConfig = (color: string) =>
  JSON.stringify({ colors: { colors: [{ name: 'primary', color }] } }, null, 2)

describe('loadSrlConfig', () => {
  it('loads srl.config.ts', async () => {
    const dir = project({ 'srl.config.ts': tsConfig('#111111') })
    const warnings: string[] = []
    const res = await loadSrlConfig(dir, { warn: (m) => warnings.push(m) })
    expect(res.configFile).toBe(join(dir, 'srl.config.ts'))
    expect(res.config.colors?.colors?.[0]?.color).toBe('#111111')
    expect(res.config.project?.livingdocs?.alternative).toBe('@acme/livingdocs')
    expect(warnings).toEqual([])
    expect(res.watchFiles).toContain(join(dir, 'srl.config.json'))
    expect(res.watchFiles).toContain(join(dir, 'srl.config.ts'))
  })

  it('falls back to srl.config.json', async () => {
    const dir = project({ 'srl.config.json': jsonConfig('#222222') })
    const res = await loadSrlConfig(dir, { warn: () => {} })
    expect(res.configFile).toBe(join(dir, 'srl.config.json'))
    expect(res.config).toEqual({ colors: { colors: [{ name: 'primary', color: '#222222' }] } })
    expect(res.warnings).toEqual([])
  })

  it('prefers srl.config.ts over srl.config.json and warns', async () => {
    const dir = project({ 'srl.config.ts': tsConfig('#333333'), 'srl.config.json': jsonConfig('#444444') })
    const warnings: string[] = []
    const res = await loadSrlConfig(dir, { warn: (m) => warnings.push(m) })
    expect(res.configFile).toBe(join(dir, 'srl.config.ts'))
    expect(res.config.colors?.colors?.[0]?.color).toBe('#333333')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/srl\.config\.ts.*srl\.config\.json/)
  })

  it('returns an empty config without a file, or throws if required', async () => {
    const dir = project({})
    const res = await loadSrlConfig(dir, { warn: () => {} })
    expect(res).toMatchObject({ config: {}, configFile: undefined })
    await expect(loadSrlConfig(dir, { required: true })).rejects.toThrow(/No srl\.config/)
  })

  it('validates the loaded file and names it in the error', async () => {
    const dir = project({
      'srl.config.json': JSON.stringify({ typography: { typography: [{ 'font-size': 12 }] } }),
    })
    await expect(loadSrlConfig(dir, { warn: () => {} })).rejects.toThrow(
      /srl\.config\.json[\s\S]*typography\.typography\[0\] needs a non-empty "name"/,
    )
  })

  it('reloads a changed file (no module cache)', async () => {
    const dir = project({ 'srl.config.ts': tsConfig('#555555') })
    await loadSrlConfig(dir, { warn: () => {} })
    writeFileSync(join(dir, 'srl.config.ts'), tsConfig('#666666'))
    const res = await loadSrlConfig(dir, { warn: () => {} })
    expect(res.config.colors?.colors?.[0]?.color).toBe('#666666')
  })
})

describe('migrateJsonConfig', () => {
  it('writes an equivalent srl.config.ts', async () => {
    const dir = project({ 'srl.config.json': jsonConfig('#777777') })
    const { file, source } = await migrateJsonConfig(dir)
    expect(file).toBe(join(dir, 'srl.config.ts'))
    expect(source.startsWith(`import { defineSrlConfig } from '@simple-reporting/core/config'\n`)).toBe(true)
    expect(existsSync(join(dir, 'srl.config.json'))).toBe(true)
    rmSync(join(dir, 'srl.config.json'))
    const res = await loadSrlConfig(dir, { warn: () => {} })
    expect(res.configFile).toBe(file)
    expect(res.config).toEqual(JSON.parse(jsonConfig('#777777')))
    await expect(migrateJsonConfig(dir)).rejects.toThrow()
  })

  it('can remove the JSON file', async () => {
    const dir = project({ 'srl.config.json': jsonConfig('#888888') })
    await migrateJsonConfig(dir, { removeJson: true })
    expect(existsSync(join(dir, 'srl.config.json'))).toBe(false)
    expect(readFileSync(join(dir, 'srl.config.ts'), 'utf8')).toContain('#888888')
  })
})

describe('normalizeSrlConfig', () => {
  it('collects all structural issues', () => {
    try {
      normalizeSrlConfig({
        colors: { colors: [{ name: 'a' }, { color: '#fff' }] },
        grid: { breakpoints: [1, 2] },
        fonts: { fonts: [1] },
        project: { livingdocs: { alternative: 3 } },
        meta: 'x',
      })
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(SrlConfigError)
      expect((e as SrlConfigError).issues).toEqual([
        '"meta" must be an object, got string',
        'colors.colors[0] ("a") needs a "color" string',
        'colors.colors[1] needs a non-empty "name"',
        'grid.breakpoints must be an object keyed by breakpoint',
        'fonts.fonts[0] must be a folder name or a font definition object',
        'project.livingdocs.alternative must be a package name or null',
      ])
    }
  })

  it('warns about unknown sections and duplicate names, and does not mutate the input', () => {
    const input = {
      colors: { colors: [{ name: 'a', color: '#000' }, { name: 'a', color: '#fff' }] },
      foo: {},
    }
    const before = structuredClone(input)
    const { config, warnings } = normalizeSrlConfig(input)
    expect(warnings).toEqual([
      'unknown section "foo" is ignored',
      'colors.colors: duplicate name "a", the last one wins',
    ])
    expect(config).toEqual(input)
    expect(config).not.toBe(input)
    expect(input).toEqual(before)
  })

  it('accepts null as livingdocs alternative', () => {
    expect(normalizeSrlConfig({ project: { livingdocs: { alternative: null } } }).warnings).toEqual([])
  })
})

describe('defineSrlConfig', () => {
  it('is a typed identity function', () => {
    const c: SrlConfig = { helpers: { 'default-list-margin': 10 } }
    expect(defineSrlConfig(c)).toBe(c)
    // @ts-expect-error typography entries need a name
    defineSrlConfig({ typography: { typography: [{ 'font-size': 12 }] } })
    // @ts-expect-error colors need a color
    defineSrlConfig({ colors: { colors: [{ name: 'x' }] } })
  })
})
