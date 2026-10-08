import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  DEFAULT_DESIGN_BASE_URL,
  renderIndexScss,
  renderScssEntries,
  resolveDesignBaseUrl,
  scanScssSources,
  type ScssSources,
} from '../src/codegen/scssEntries'
import { writeSrlScss } from '../src/codegen/writeScss'

const TP = join(__dirname, '../../../../simple-reporting-library-test-project')
const hasTP = existsSync(join(TP, '.srl', 'imports', 'app.scss'))
const TP_DIRS = { scssDir: 'src/assets/scss', fontsDir: 'src/assets/fonts', livingdocsDir: 'livingdocs' }

/**
 * SRL 1 emitted font files in unsorted glob order; SRL 2 sorts them. Sort the
 * (consecutive) font lines on both sides before comparing.
 */
function sortFontLines(s: string): string {
  const lines = s.split('\n')
  const idx = lines.flatMap((l, i) => (l.includes('/assets/fonts/') ? [i] : []))
  const sorted = idx.map((i) => lines[i]!).sort()
  idx.forEach((i, n) => (lines[i] = sorted[n]!))
  return lines.join('\n')
}

describe.skipIf(!hasTP)('scss entries – golden against SRL 1 test project', () => {
  const sources = scanScssSources(TP, TP_DIRS)
  const { files, warnings } = renderScssEntries(sources, {
    entriesDir: join(TP, '.srl', 'imports'),
    tokensDir: () => join(TP, 'srl'),
    design: {
      baseUrl: DEFAULT_DESIGN_BASE_URL,
      name: 'simple-reporting-library-test-project',
      version: '0.0.1',
    },
  })
  const golden = (file: string) =>
    readFileSync(join(TP, '.srl', 'imports', file), 'utf8').replaceAll(
      '@simple-reporting/base',
      '@simple-reporting/core',
    )

  for (const [ours, theirs] of [
    ['app.scss', 'app.scss'],
    ['editor.scss', 'ldd.scss'],
    ['pdf.scss', 'pdf.scss'],
    ['word.scss', 'word.scss'],
    ['xbrl.scss', 'xbrl.scss'],
    ['fonts.scss', 'fonts.scss'],
  ] as const) {
    it(`${ours} = SRL 1 ${theirs}`, () => {
      expect(sortFontLines(files[ours])).toBe(sortFontLines(golden(theirs)))
    })
  }

  it('emits no warnings for a project without legacy ldd.scss', () => {
    expect(warnings).toEqual([])
  })

  it('index.scss = SRL 1 srl/index.scss', () => {
    expect(renderIndexScss(sources, { tokensDir: join(TP, 'srl') })).toBe(
      readFileSync(join(TP, 'srl', 'index.scss'), 'utf8'),
    )
  })
})

describe('scss entries – rules', () => {
  const root = mkdtempSync(join(tmpdir(), 'srl-entries-'))
  afterAll(() => rmSync(root, { recursive: true, force: true }))
  const touch = (rel: string, content = '') => {
    const f = join(root, rel)
    mkdirSync(dirname(f), { recursive: true })
    writeFileSync(f, content)
  }
  touch('app/assets/scss/general.scss')
  touch('app/assets/scss/ldd.scss')
  touch('app/assets/scss/editor.scss')
  touch('app/assets/scss/placeholders/b/z.scss')
  touch('app/assets/scss/placeholders/a.scss')
  // Properties group sorts before the others by name, must still come last.
  touch('livingdocs/000.Properties/grid/scss/general.scss')
  touch('livingdocs/010.Text/010.lead/scss/ldd.scss')
  touch('livingdocs/010.Text/010.lead/scss/editor.scss')
  touch('livingdocs/010.Text/scss/app.scss')
  touch('livingdocs/020.text-b/010.x/scss/app.scss')
  touch('livingdocs/020.Text-a/010.x/scss/app.scss')
  touch('package.json', JSON.stringify({ name: 'demo', version: '1.2.3' }))

  const sources: ScssSources = scanScssSources(root)
  const outDir = join(root, '.srl', 'scss')
  const render = () =>
    renderScssEntries(sources, {
      entriesDir: join(outDir, 'entries'),
      tokensDir: (t) => join(outDir, t),
      design: { baseUrl: 'https://x', name: 'demo', version: '1.2.3' },
    })

  it('uses the SRL 2 default folders and per-target token folders', () => {
    const { files } = render()
    expect(files['app.scss'].split('\n').slice(0, 3)).toEqual([
      '@use "../app/config" as *;',
      '@use "@simple-reporting/core/scss/init-root.scss" as *;',
      '@use "../../../app/assets/scss/general.scss" as *;',
    ])
    expect(files['pdf.scss']).toContain('@use "../pdf/config" as *;')
    expect(files['xbrl.scss']).toContain('@use "@simple-reporting/core/scss/xbrl-core-styles.scss" as *;')
    expect(files['xbrl.scss']).not.toContain('general.scss')
  })

  it('puts legacy ldd.scss and editor.scss into editor, with a warning', () => {
    const { files, warnings } = render()
    const editor = files['editor.scss']
    expect(editor).toContain('app/assets/scss/ldd.scss')
    expect(editor).toContain('app/assets/scss/editor.scss')
    expect(editor.indexOf('010.lead/scss/ldd.scss')).toBeLessThan(editor.indexOf('010.lead/scss/editor.scss'))
    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toMatch(/app\/assets\/scss\/ldd\.scss.*editor\.scss/)
  })

  it('sorts livingdocs case-insensitively, groups before their components, Properties last', () => {
    const app = render().files['app.scss']
    const order = [
      '010.Text/scss/app.scss',
      '020.Text-a/010.x/scss/app.scss',
      '020.text-b/010.x/scss/app.scss',
      '000.Properties/grid/scss/general.scss',
      'core-styles.scss',
    ].map((s) => app.indexOf(s))
    expect(order.every((v) => v > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('writes an empty fonts.scss and no font import without font files', () => {
    const { files } = render()
    expect(files['fonts.scss']).toBe('')
    expect(files['pdf.scss']).not.toContain('fonts.scss')
  })

  it('renders index.scss with paths relative to the token folder', () => {
    const index = renderIndexScss(sources, { tokensDir: join(outDir, 'app') })
    expect(index.split('\n').slice(0, 3)).toEqual([
      `@use './config';`,
      '@use "../../../app/assets/scss/placeholders/a.scss" as appassetsscssplaceholdersascss;',
      '@use "../../../app/assets/scss/placeholders/b/z.scss" as appassetsscssplaceholdersbzscss;',
    ])
  })

  it('resolves the design URL from env (SRL_EDITOR_DESIGN_URL before INTERNAL_LDD_URL)', () => {
    expect(resolveDesignBaseUrl({})).toBe('https://nswow-ld.nswow.ch/designs')
    expect(resolveDesignBaseUrl({ INTERNAL_LDD_URL: 'https://a' })).toBe('https://a')
    expect(resolveDesignBaseUrl({ INTERNAL_LDD_URL: 'https://a', SRL_EDITOR_DESIGN_URL: 'https://b' })).toBe(
      'https://b',
    )
  })

  it('writeSrlScss writes per-target folders and only changed files', async () => {
    touch('app/assets/fonts/x/x.scss')
    const config = { colors: { colors: [{ name: 'red', color: '#f00' }] } }
    const first = await writeSrlScss({ rootDir: root, target: 'pdf', config, design: { baseUrl: 'https://d' } })
    expect(first.srlDir).toBe(join(outDir, 'pdf'))
    expect(first.entry).toBe(join(outDir, 'entries', 'pdf.scss'))
    for (const f of ['config', 'colors', 'typography', 'index', 'system', 'meta', 'fa/index']) {
      expect(existsSync(join(outDir, 'pdf', `${f}.scss`))).toBe(true)
    }
    expect(readFileSync(join(outDir, 'pdf', 'config.scss'), 'utf8')).toContain('$build: pdf')
    expect(readFileSync(join(outDir, 'entries', 'fonts.scss'), 'utf8')).toBe(
      '@import "https://d/demo/1.2.3/fonts/style.css";',
    )
    expect(first.written).toHaveLength(first.files.length)

    const second = await writeSrlScss({ rootDir: root, target: 'pdf', config, design: { baseUrl: 'https://d' } })
    expect(second.written).toEqual([])

    const word = await writeSrlScss({ rootDir: root, target: 'word', config, design: { baseUrl: 'https://d' } })
    expect(readFileSync(join(outDir, 'word', 'config.scss'), 'utf8')).toContain('$size-unit: pt')
    // the shared fonts.scss did not change
    expect(word.written).not.toContain(join(outDir, 'entries', 'fonts.scss'))
    expect(readFileSync(join(outDir, 'pdf', 'config.scss'), 'utf8')).toContain('$build: pdf')
  })
})
