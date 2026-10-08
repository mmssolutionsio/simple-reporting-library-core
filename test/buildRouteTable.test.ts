import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { describeIf } from './describeIf'
import { buildRouteTable, type NsWowRouting, type NsWowSettings, type RouteTable } from '../src/shared'

const fixtures = resolve(__dirname, '../../../fixtures/data')
const hasFixtures = existsSync(join(fixtures, 'base'))

function load(variant: string): RouteTable {
  const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'))
  const settings: NsWowSettings = json(join(fixtures, 'base/json/settings.json'))
  const routing: Record<string, NsWowRouting> = {}
  for (const locale of settings.languages) {
    routing[locale] = json(join(fixtures, variant, `json/routing_${locale}.json`))
  }
  return buildRouteTable({ settings, routing })
}

const paths = (table: RouteTable, locale: string) => table.locale[locale]!.entries.map((e) => e.path)
const pathOf = (table: RouteTable, locale: string, uuid: string) => table.locale[locale]!.byUuid[uuid]?.path

describeIf(hasFixtures)('buildRouteTable with fixtures (run `npm run fixtures` first)', () => {
  describe('nav-nested', () => {
    const table = load('nav-nested')

    it('follows the navigation hierarchy (en)', () => {
      expect(paths(table, 'en').slice(0, 15)).toEqual([
        '/en',
        '/en/business-report/key-figures',
        '/en/business-report/letter-to-the-shareholders',
        '/en/business-report/highlights',
        '/en/governance-report/corporate-governance',
        '/en/governance-report/corporate-governance/members-of-the-board-of-directors',
        '/en/governance-report/corporate-governance/board-of-directors',
        '/en/governance-report/group-management',
        '/en/remuneration-report/remuneration-report',
        '/en/sustainability-report/esg-about-this-report',
        '/en/sustainability-report/ecology-environment/esg-environmental-responsibility',
        '/en/sustainability-report/ecology-environment/sustainable-workplace',
        '/en/financial-report/consolidated-statement-of-comprehensive-income',
        '/en/financial-report/notes-group',
        // first flat article in routing order
        expect.stringMatching(/^\/en\/[^/]+$/),
      ])
    })

    it('redirects levels without article to their first sub page', () => {
      expect(table.redirects).toMatchObject({
        '/': '/en',
        '/en/business-report': '/en/business-report/key-figures',
        '/en/governance-report': '/en/governance-report/corporate-governance',
        '/en/remuneration-report': '/en/remuneration-report/remuneration-report',
        '/en/sustainability-report': '/en/sustainability-report/esg-about-this-report',
        '/en/sustainability-report/ecology-environment':
          '/en/sustainability-report/ecology-environment/esg-environmental-responsibility',
        '/en/financial-report': '/en/financial-report/consolidated-statement-of-comprehensive-income',
      })
      expect(table.redirects).not.toHaveProperty('/en/empty-level')
    })

    it('transliterates umlauts in German labels', () => {
      expect(table.redirects['/de/verguetungsbericht']).toBe('/de/verguetungsbericht/remuneration-report')
      expect(pathOf(table, 'de', '04-07-esg-sustainable-workplace')).toBe(
        '/de/nachhaltigkeitsbericht/oekologie-umwelt/sustainable-workplace',
      )
    })

    it('puts articles outside the navigation flat under the locale', () => {
      expect(pathOf(table, 'en', '04-02-esg-governance')).toBe('/en/esg-governance')
      expect(pathOf(table, 'en', 'notes_holding')).toBe('/en/notes-holding')
      expect(pathOf(table, 'en', '05-07-statutory-auditors-report')).toBe('/en/statutory-auditors-report')
    })

    it('keeps the first occurrence of an article in the navigation', () => {
      expect(pathOf(table, 'en', '01-01-key-figures')).toBe('/en/business-report/key-figures')
      expect(table.issues).toContainEqual(
        expect.objectContaining({ code: 'duplicate-navigation-entry', locale: 'en', uuid: '01-01-key-figures' }),
      )
    })

    it('gives dialog articles no route, also when they are in the navigation', () => {
      const en = table.locale.en!
      expect(Object.keys(en.dialogs)).toHaveLength(31)
      expect(en.byUuid['notes-group-12']).toBeUndefined()
      expect(Object.values(table.byPath).some((e) => /^notes-[a-z0-9]+-\d+$/.test(e.uuid))).toBe(false)
      expect(table.issues).toContainEqual(expect.objectContaining({ code: 'dialog-in-navigation', uuid: 'notes-group-12' }))
    })

    it('warns about levels without routed article', () => {
      expect(table.issues).toContainEqual(expect.objectContaining({ code: 'empty-menu-entry', path: '/en/empty-level' }))
    })

    it('stores breadcrumbs of navigation ancestors', () => {
      expect(table.locale.en!.byUuid['02-03-board-of-directors']!.breadcrumbs).toEqual([
        { label: 'Governance Report', path: '/en/governance-report' },
        { label: 'Corporate Governance', path: '/en/governance-report/corporate-governance' },
      ])
    })

    it('links the same article across languages', () => {
      expect(table.alternates['02-03-board-of-directors']).toEqual({
        de: '/de/corporate-governance/corporate-governance/board-of-directors',
        en: '/en/governance-report/corporate-governance/board-of-directors',
      })
    })
  })

  describe('no-nav', () => {
    const table = load('no-nav')

    it('puts every article flat under the locale', () => {
      for (const locale of ['de', 'en']) {
        for (const path of paths(table, locale)) {
          expect(path).toMatch(new RegExp(`^/${locale}(/[^/]+)?$`))
        }
      }
      expect(pathOf(table, 'en', '01-01-key-figures')).toBe('/en/key-figures')
      expect(pathOf(table, 'en', '00-00a-home')).toBe('/en')
      expect(table.redirects).toEqual({ '/': '/en' })
    })

    it('routes every non-dialog article exactly once', () => {
      // 61 pages, 31 dialogs, 1 lost slug collision in en ("search")
      expect(table.locale.de!.entries).toHaveLength(30)
      expect(table.locale.en!.entries).toHaveLength(29)
    })

    it('warns about duplicate slugs, first one wins', () => {
      expect(pathOf(table, 'en', '00-02-search')).toBe('/en/search')
      expect(pathOf(table, 'en', 'search-999')).toBeUndefined()
      expect(table.issues).toContainEqual(expect.objectContaining({ code: 'duplicate-slug', uuid: 'search-999' }))
      expect(table.issues).toContainEqual(expect.objectContaining({ code: 'path-collision', uuid: 'search-999' }))
    })

    it('marks special pages', () => {
      expect(table.locale.en!.byUuid['download-999']).toMatchObject({ kind: 'special', component: 'DownloadCenter' })
      expect(table.locale.de!.byUuid['search-999']).toMatchObject({ kind: 'special', component: 'Search' })
    })
  })

  it('nav-copy uses menuMain as navigation', () => {
    const table = load('nav-copy')
    expect(pathOf(table, 'en', '05-07-statutory-auditors-report')).toBe('/en/financial-report/statutory-auditors-report')
    expect(pathOf(table, 'de', '01-01-key-figures')).toBe('/de/unternehmensbericht/key-figures')
  })
})

describe('buildRouteTable edge cases', () => {
  const page = (uuid: string, slug: string, extra = {}) => ({
    uuid,
    name: uuid,
    slug,
    translatedTitle: uuid,
    index: false,
    ...extra,
  })

  it('skips locales without routing data and falls back to the first locale', () => {
    const table = buildRouteTable({
      settings: { languages: ['fr', 'de'], defaultLanguage: 'fr' },
      routing: { de: { version: 'v1.0', pages: [page('a', 'a', { index: true })], menu: {} } },
    })
    expect(table.locales).toEqual(['de'])
    expect(table.defaultLocale).toBe('de')
    expect(table.redirects['/']).toBe('/de')
    expect(table.issues).toContainEqual(expect.objectContaining({ code: 'missing-routing', locale: 'fr' }))
  })

  it('reports navigation entries pointing to unknown pages', () => {
    const table = buildRouteTable({
      settings: { languages: ['de'], defaultLanguage: 'de' },
      routing: {
        de: {
          version: 'v1.0',
          pages: [page('a', 'a')],
          menu: { navigation: [{ label: 'X', type: 'MenuEntry', submenuEntries: [{ label: 'Y', type: 'Article', page: 'missing' }] }] },
        },
      },
    })
    expect(table.issues.map((i) => i.code)).toEqual(['unknown-page', 'empty-menu-entry'])
    expect(table.locale.de!.byUuid.a!.path).toBe('/de/a')
  })
})
