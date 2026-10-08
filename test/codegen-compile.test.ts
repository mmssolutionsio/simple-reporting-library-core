import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compileAsync, type FileImporter } from 'sass-embedded'
import { afterAll, describe, expect, it } from 'vitest'
import { scanScssSources } from '../src/codegen/scssEntries'
import type { SrlBuildTarget } from '../src/codegen/tokens'
import { srlScssAliases, writeSrlScss } from '../src/codegen/writeScss'

/**
 * Compiles the generated entries against the SRL 1 test project's SCSS and
 * livingdocs sources with the SRL 2 core SCSS. The importer mimics the
 * aliases the Nuxt module sets up per target.
 */
const TP = join(__dirname, '../../../../simple-reporting-library-test-project')
const hasTP = existsSync(join(TP, 'node_modules', '@fortawesome', 'fontawesome-free'))
const CORE_SCSS = join(__dirname, '..', 'scss')
const CORE_NODE_MODULES = join(__dirname, '../../../node_modules')

function importerFor(srlDir: string): FileImporter<'async'> {
  const aliases = srlScssAliases(srlDir, 'free')
  return {
    findFileUrl(url) {
      if (url === 'srl' || url.startsWith('srl/')) {
        return pathToFileURL(join(aliases.srl, url.slice(3)))
      }
      if (url === 'fa-source' || url === 'fa-font') return pathToFileURL(aliases[url])
      if (url.startsWith('@simple-reporting/core/scss/')) {
        return pathToFileURL(join(CORE_SCSS, url.slice('@simple-reporting/core/scss/'.length)))
      }
      if (url === 'modern-css-reset') {
        return pathToFileURL(join(CORE_NODE_MODULES, 'modern-css-reset', 'dist', 'reset.min.css'))
      }
      return null
    },
  }
}

describe.skipIf(!hasTP)('generated entries compile with Sass', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'srl-compile-'))
  afterAll(() => rmSync(outDir, { recursive: true, force: true }))
  const config = JSON.parse(readFileSync(join(TP, 'srl.config.json'), 'utf8'))
  const sources = scanScssSources(TP, { scssDir: 'src/assets/scss', fontsDir: 'src/assets/fonts' })

  const targets: SrlBuildTarget[] = ['app', 'editor', 'pdf', 'word', 'xbrl']
  for (const target of targets) {
    it(
      `compiles entries/${target}.scss`,
      async () => {
        const res = await writeSrlScss({
          rootDir: TP,
          outDir,
          target,
          config,
          sources,
          design: { baseUrl: 'https://example.test/designs', name: 'tp', version: '0.0.1' },
        })
        const result = await compileAsync(res.entry, {
          importers: [importerFor(res.srlDir)],
          loadPaths: [join(TP, 'node_modules')],
          silenceDeprecations: ['import', 'global-builtin', 'mixed-decls', 'color-functions'] as any,
          logger: { warn: () => {}, debug: () => {} },
        })
        expect(result.css.length).toBeGreaterThan(1000)
        if (target === 'word') {
          // Word resolves sizes statically in pt (no custom properties).
          expect(result.css).toMatch(/\.srl-lead \{[^}]*font-size: [\d.]+pt;/)
        }
        if (target === 'app') {
          expect(result.css).toMatch(/--srl-[\w-]+: [\d.]+rem;/)
          expect(result.css).toContain('@font-face')
        }
      },
      60_000,
    )
  }
})
