import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zipSync, strToU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { normalizeBase, parseTargets } from '../src/cli/commands/build'
import { findDataRoot, importData } from '../src/cli/commands/data'
import { readAlternative, writeAlternative } from '../src/cli/context'
import { checkDataVersions } from '../src/shared/dataVersion'
import { checkUpdates } from '../src/update/check'

describe('parseTargets', () => {
  it('defaults to the SRL 1 target set and maps legacy names', () => {
    expect(parseTargets(undefined)).toEqual(['app', 'editor', 'pdf', 'word', 'xbrl'])
    expect(parseTargets('ldd,xhtml,generate')).toEqual(['editor', 'xbrl', 'generate'])
    expect(() => parseTargets('foo')).toThrow('Unknown target')
  })
})

describe('normalizeBase', () => {
  it.each([
    [undefined, '/'],
    ['/', '/'],
    ['report', '/report/'],
    ['/report/2030', '/report/2030/'],
    ['/report/', '/report/'],
  ])('%s -> %s', (input, expected) => expect(normalizeBase(input)).toBe(expected))
})

describe('checkUpdates', () => {
  const latest: Record<string, string> = { a: '2.1.0', b: '1.0.1', c: '1.0.0', d: '3.0.0' }
  const fetchLatest = async (name: string) => latest[name]

  it('detects patch, minor and major updates with semver (SRL 1 missed minor/major)', async () => {
    const updates = await checkUpdates(
      [
        { name: 'a', version: '2.0.5' },
        { name: 'b', version: '1.0.0' },
        { name: 'c', version: '1.0.0' },
        { name: 'd', version: '2.9.9' },
        { name: 'offline', version: '1.0.0' },
      ],
      fetchLatest,
    )
    expect(updates.map((u) => [u.name, u.type])).toEqual([
      ['a', 'minor'],
      ['b', 'patch'],
      ['d', 'major'],
    ])
  })

  it('never reports downgrades', async () => {
    expect(await checkUpdates([{ name: 'c', version: '1.2.0' }], fetchLatest)).toEqual([])
  })
})

describe('checkDataVersions', () => {
  it('flags unknown nswow data versions', () => {
    expect(checkDataVersions({ 'json/settings.json': { version: 'v1.0' }, 'json/routing_en.json': { version: 'v2.0' } })).toEqual([
      { file: 'json/routing_en.json', version: 'v2.0' },
    ])
  })
})

describe('project.livingdocs.alternative', () => {
  it('reads and writes srl.config.json', async () => {
    const root = mkdtempSync(join(tmpdir(), 'srl-cfg-'))
    writeFileSync(join(root, 'srl.config.json'), JSON.stringify({ colors: { colors: [] } }))
    expect(await readAlternative(root)).toBeUndefined()
    await writeAlternative(root, '@acme/livingdocs')
    expect(await readAlternative(root)).toBe('@acme/livingdocs')
    expect(JSON.parse(readFileSync(join(root, 'srl.config.json'), 'utf8')).colors).toEqual({ colors: [] })
    await writeAlternative(root, null)
    expect(await readAlternative(root)).toBeNull()
  })

  it('reads and writes srl.config.ts with defineSrlConfig', async () => {
    const root = mkdtempSync(join(tmpdir(), 'srl-cfg-'))
    writeFileSync(
      join(root, 'srl.config.ts'),
      "import { defineSrlConfig } from '@simple-reporting/core/config'\n\nexport default defineSrlConfig({\n  colors: { colors: [] },\n})\n",
    )
    await writeAlternative(root, '@acme/livingdocs')
    const source = readFileSync(join(root, 'srl.config.ts'), 'utf8')
    expect(source).toContain('defineSrlConfig(')
    expect(source).toMatch(/alternative: ['"]@acme\/livingdocs['"]/)
    expect(await readAlternative(root)).toBe('@acme/livingdocs')
    await writeAlternative(root, null)
    expect(readFileSync(join(root, 'srl.config.ts'), 'utf8')).toMatch(/alternative: null/)
    expect(await readAlternative(root)).toBeNull()
  })

  it('reads an explicit null in srl.config.ts (as written by migrateJsonConfig)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'srl-cfg-'))
    const write = (project: string) =>
      writeFileSync(
        join(root, 'srl.config.ts'),
        `import { defineSrlConfig } from '@simple-reporting/core/config'\n\nexport default defineSrlConfig({\n  "colors": { "colors": [] },\n${project}})\n`,
      )
    write('  "project": {\n    "livingdocs": {\n      "alternative": null\n    }\n  }\n')
    expect(await readAlternative(root)).toBeNull()
    write('  "project": {\n    "livingdocs": {}\n  }\n')
    expect(await readAlternative(root)).toBeUndefined()
    write('')
    expect(await readAlternative(root)).toBeUndefined()
  })
})

describe('srl data import', () => {
  function previewZip(): string {
    const dir = mkdtempSync(join(tmpdir(), 'srl-zip-'))
    const file = join(dir, 'preview.zip')
    writeFileSync(
      file,
      zipSync({
        'preview/index.html': strToU8('<html></html>'),
        'preview/_nuxt/app.js': strToU8(''),
        'preview/json/settings.json': strToU8(JSON.stringify({ version: 'v1.0', languages: ['en'] })),
        'preview/html/en/Home.html': strToU8('<p>Home</p>'),
        'preview/images/a.png': new Uint8Array([1, 2, 3]),
      }),
    )
    return file
  }

  it('finds the data folder inside a nested preview download', () => {
    const dir = mkdtempSync(join(tmpdir(), 'srl-find-'))
    mkdirSync(join(dir, 'a/b/json'), { recursive: true })
    writeFileSync(join(dir, 'a/b/json/settings.json'), '{}')
    expect(findDataRoot(dir)).toBe(join(dir, 'a/b'))
  })

  it('imports json, html, images and downloads from a zip into data/', async () => {
    const root = mkdtempSync(join(tmpdir(), 'srl-project-'))
    writeFileSync(join(root, 'package.json'), '{}')
    const cwd = process.cwd()
    process.chdir(root)
    try {
      await importData.run!({ args: { _: [], source: previewZip(), yes: true } } as never)
    } finally {
      process.chdir(cwd)
    }
    expect(readFileSync(join(root, 'data/html/en/Home.html'), 'utf8')).toBe('<p>Home</p>')
    expect(readFileSync(join(root, 'data/images/a.png'))).toHaveLength(3)
    expect(() => readFileSync(join(root, 'data/index.html'))).toThrow()
  })
})
