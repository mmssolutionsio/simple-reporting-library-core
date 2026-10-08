import { describe, expect, it } from 'vitest'
import { buildRouteTable, type NsWowArticle, type NsWowMenu, type NsWowRouting } from '../src/shared'
import { activeTrail, buildMenuItems } from '../src/runtime/utils/menu'
import { breadcrumbs, languageSwitch, prevNext, readingOrder } from '../src/runtime/utils/navigation'
import { deepMerge } from '../src/runtime/utils/object'
import { searchIndex, searchSnippet, type SrlSearchEntry } from '../src/runtime/utils/search'
import { isInlineSvg, parseSvg } from '../src/runtime/utils/svg'
import { viewportFor, DEFAULT_BREAKPOINTS } from '../src/runtime/utils/viewport'

const page = (uuid: string, slug: string, extra: Partial<NsWowArticle> = {}): NsWowArticle => ({
  uuid,
  name: uuid,
  slug,
  translatedTitle: slug.toUpperCase(),
  index: false,
  ...extra,
})
const article = (pageUuid: string, label: string, submenuEntries?: NsWowMenu[], anchor = ''): NsWowMenu => ({
  label,
  type: 'Article',
  page: pageUuid,
  anchor,
  ...(submenuEntries ? { submenuEntries } : {}),
})
const level = (label: string, submenuEntries: NsWowMenu[]): NsWowMenu => ({ label, type: 'MenuEntry', submenuEntries })

const navigation: NsWowMenu[] = [
  level('Business Report', [article('kf', 'Key Figures'), article('letter', 'Letter', undefined, 'intro')]),
  article('gov', 'Governance', [article('board', 'Board')]),
  { label: 'External', type: 'ExternalLink', url: 'https://example.com' },
  { label: 'Legacy', type: 'ExternalLink', url: './en/board#members' },
  { label: 'Report PDF', type: 'ExternalLink', url: './downloads/en/report.pdf' },
]

function routing(locale: string, withNavigation: boolean, skip: string[] = []): NsWowRouting {
  const pages = [
    page('home', 'home', { index: true }),
    page('kf', `key-figures-${locale}`),
    page('letter', 'letter'),
    page('gov', 'governance'),
    page('board', 'board'),
    page('imprint', 'imprint'),
    page('search', 'search', { component: 'Search' }),
    page('notes-group-1', 'note-1'),
  ].filter((p) => !skip.includes(p.uuid))
  return { version: '1', pages, menu: withNavigation ? { navigation, menuMain: navigation } : { menuMain: navigation } }
}

const settings = { languages: ['en', 'de'], defaultLanguage: 'en' }
const nested = buildRouteTable({ settings, routing: { en: routing('en', true), de: routing('de', true, ['board']) } })
const flat = buildRouteTable({ settings, routing: { en: routing('en', false), de: routing('de', false) } })

describe('buildMenuItems', () => {
  const items = buildMenuItems(navigation, {
    table: nested,
    locale: 'en',
    currentPath: '/en/governance/board/',
    base: '/report/',
  })

  it('resolves hrefs through the route table', () => {
    expect(items.map((item) => item.href)).toEqual([
      '/en/business-report/key-figures-en', // MenuEntry → first child
      '/en/governance',
      'https://example.com',
      '/en/governance/board#members', // legacy ./<locale>/<slug> link
      '/report/downloads/en/report.pdf', // file link with base
    ])
    expect(items[0]!.children!.map((item) => item.href)).toEqual([
      '/en/business-report/key-figures-en',
      '/en/business-report/letter#intro',
    ])
  })

  it('marks the current page and its ancestors active', () => {
    expect(items.map((item) => !!item.active)).toEqual([false, true, false, true, false])
    expect(activeTrail(items).map((item) => item.label)).toEqual(['Governance', 'Board'])
  })

  it('uses flat paths without navigation menu', () => {
    const flatItems = buildMenuItems(navigation, { table: flat, locale: 'en', currentPath: '/en/board' })
    expect(flatItems[1]!.children![0]!.href).toBe('/en/board')
    expect(flatItems[1]!.active).toBe(true)
  })
})

describe('prev/next', () => {
  it('follows the depth-first navigation order (cyclic)', () => {
    const order = readingOrder(nested, 'en', navigation)
    expect(order.map((entry) => entry.uuid)).toEqual(['kf', 'letter', 'gov', 'board'])
    const { prev, next } = prevNext(order, '/en/governance')
    expect([prev?.uuid, next?.uuid]).toEqual(['letter', 'board'])
    expect(prevNext(order, '/en/governance/board').next?.uuid).toBe('kf')
    expect(prevNext(order, '/en/governance/board', { cyclic: false }).next).toBeUndefined()
  })

  it('uses the routing order without menu and skips special pages', () => {
    const order = readingOrder(flat, 'en')
    expect(order.map((entry) => entry.uuid)).toEqual(['home', 'kf', 'letter', 'gov', 'board', 'imprint'])
    expect(prevNext(order, '/en/imprint').next?.uuid).toBe('home')
  })

  it('returns nothing for pages outside the order', () => {
    expect(prevNext(readingOrder(nested, 'en', navigation), '/en/imprint')).toEqual({ index: -1 })
  })
})

describe('languageSwitch', () => {
  it('links the same article in the other locale', () => {
    const result = languageSwitch(nested, '/en/business-report/key-figures-en', 'en')
    expect(result.current.href).toBe('/en/business-report/key-figures-en')
    expect(result.items).toEqual([
      { label: 'de', locale: 'de', href: '/de/business-report/key-figures-de', active: false, translated: true },
    ])
  })

  it('falls back to the index page of a locale without translation', () => {
    const [de] = languageSwitch(nested, '/en/governance/board', 'en').items
    expect(de).toMatchObject({ href: '/de', translated: false })
  })
})

describe('breadcrumbs', () => {
  it('lists the navigation ancestors and the page', () => {
    expect(breadcrumbs(nested, '/en/governance/board')).toEqual([
      { label: 'GOVERNANCE', path: '/en/governance', current: false },
      { label: 'BOARD', path: '/en/governance/board', current: true },
    ])
  })
})

describe('search', () => {
  const index: SrlSearchEntry[] = [
    { uuid: 'a', path: '/en/a', title: 'Annual Report', text: 'Net sales increased to 5 million. Profit (EBIT) grew strongly.' },
    { uuid: 'b', path: '/en/b', title: 'Sustainability', text: 'Our emissions decreased. Net zero by 2040.' },
  ]

  it('requires every word in the text or the query in the title', () => {
    expect(searchIndex(index, 'net sales').map((r) => r.entry.uuid)).toEqual(['a'])
    expect(searchIndex(index, 'net').map((r) => r.entry.uuid)).toEqual(['a', 'b'])
    expect(searchIndex(index, 'annual rep').map((r) => r.entry.uuid)).toEqual(['a'])
    expect(searchIndex(index, 'ne')).toEqual([]) // shorter than minLength
  })

  it('treats words literally', () => {
    expect(searchIndex(index, '(EBIT)').map((r) => r.entry.uuid)).toEqual(['a'])
  })

  it('builds snippets around the hits and bolds the words', () => {
    const snippet = searchSnippet('x'.repeat(100) + ' profit here ' + 'y'.repeat(100), 'profit', { charsAround: 10 })
    expect(snippet.text).toBe('...xxxxxxxxx profit her...')
    expect(snippet.html).toBe('...xxxxxxxxx <b>profit</b> her...')
    expect(searchSnippet('a <b> profit', 'profit', { boldTheWord: false }).html).toBe('a &lt;b&gt; profit')
  })
})

describe('helpers', () => {
  it('deep merges messages without mutating', () => {
    const project = { page: { title: 'Report', back: 'Back' } }
    expect(deepMerge(project, { page: { title: 'Annual Report 2030' } })).toEqual({
      page: { title: 'Annual Report 2030', back: 'Back' },
    })
    expect(project.page.title).toBe('Report')
  })

  it('parses inline svg', () => {
    expect(isInlineSvg('<svg viewBox="0 0 1 1"><path d="M0"/></svg>')).toBe(true)
    expect(isInlineSvg('/images/a.svg')).toBe(false)
    expect(parseSvg(`data:image/svg+xml,${encodeURIComponent('<svg class="a" aria-hidden><g/></svg>')}`)).toEqual({
      attrs: { class: 'a', 'aria-hidden': '' },
      inner: '<g/>',
    })
  })

  it('maps widths to breakpoints', () => {
    expect(viewportFor(1000, DEFAULT_BREAKPOINTS)).toBe('tablet-ls')
    expect(viewportFor(100, DEFAULT_BREAKPOINTS)).toBe('phone-pt')
  })
})
