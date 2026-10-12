import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { describeIf } from './describeIf'
import {
  buildRouteTable,
  extractSearchText,
  prepareArticleHtml,
  type NsWowRouting,
  type SrlComponentNode,
  type SrlNode,
} from '../src/shared'

const page = (uuid: string, slug: string, extra = {}) => ({ uuid, name: uuid, slug, translatedTitle: uuid, index: false, ...extra })
const routing: NsWowRouting = {
  version: 'v1.0',
  pages: [page('home', 'home', { index: true }), page('kf', 'key-figures'), page('notes-group-12', 'inventories')],
  menu: { navigation: [{ label: 'Report', type: 'MenuEntry', submenuEntries: [{ label: 'KF', type: 'Article', page: 'kf' }] }] },
}
const table = buildRouteTable({ settings: { languages: ['en'], defaultLanguage: 'en' }, routing: { en: routing } })
const ctx = { table, locale: 'en', base: '/report/' }

const walk = (nodes: SrlNode[], visit: (node: Exclude<SrlNode, string>) => void) => {
  for (const node of nodes) {
    if (typeof node === 'string') continue
    visit(node)
    if (node.t === 'el') walk(node.children, visit)
    if (node.t === 'c') Object.values(node.slots).forEach((slot) => walk(slot.children, visit))
  }
}
const components = (nodes: SrlNode[]) => {
  const found: SrlComponentNode[] = []
  walk(nodes, (node) => node.t === 'c' && found.push(node))
  return found
}
const allHtml = (nodes: SrlNode[]) => JSON.stringify(nodes)

describe('prepareArticleHtml', () => {
  it('turns popup links into dialog buttons', () => {
    const { nodes, dialogs } = prepareArticleHtml(
      '<p><a class="note-link" href="./en/inventories" data-article-name="notes-group-12" data-note-target="popup">12</a></p>',
      ctx,
    )
    expect(dialogs).toEqual(['notes-group-12'])
    expect(nodes).toEqual([
      {
        t: 'el',
        tag: 'p',
        attrs: {},
        children: [
          {
            t: 'c',
            tag: 'srl-article-dialog-button',
            attrs: { class: 'note-link', 'data-note-target': 'popup', uuid: 'notes-group-12' },
            bind: {},
            slots: { default: { children: ['12'] } },
          },
        ],
      },
    ])
  })

  it('rewrites internal links to the new URLs with base', () => {
    const { nodes, unresolvedLinks } = prepareArticleHtml(
      '<p><a href="./en/key-figures#t1">a</a><a href="./en/home">b</a><a href="./en/gone">c</a><a href="https://x.y">d</a></p>',
      ctx,
    )
    expect(nodes).toEqual([
      {
        t: 'html',
        tag: 'p',
        attrs: {},
        html: '<a href="/report/en/report/key-figures#t1">a</a><a href="/report/en">b</a><a href="./en/gone">c</a><a href="https://x.y">d</a>',
      },
    ])
    expect(unresolvedLinks).toEqual(['./en/gone'])
  })

  it('rewrites image and download paths including srcset', () => {
    const { nodes } = prepareArticleHtml(
      '<img src="./images/a_width-400.jpeg" srcset="./images/a_width-2048.jpeg 2048w,./images/a_width-768.jpeg 768w"><a href="./downloads/en/r.pdf">r</a>',
      ctx,
    )
    const html = allHtml(nodes)
    expect(html).toContain('"src":"/report/images/a_width-400.jpeg"')
    expect(html).toContain('"srcset":"/report/images/a_width-2048.jpeg 2048w, /report/images/a_width-768.jpeg 768w"')
    expect(html).toContain('"href":"/report/downloads/en/r.pdf"')
    expect(nodes[0]).toMatchObject({ t: 'el', tag: 'img', children: [] })
  })

  it('rewrites image urls in style attributes and <style> like SRL 1 <base href>', () => {
    const { nodes, styles } = prepareArticleHtml(
      '<style>.a{background:url("./images/b.png")}</style><div style="background-image: url(./images/a.png); --large-url: url(../images/a_width-1280.png)"></div>',
      ctx,
    )
    expect(allHtml(nodes)).toContain('background-image: url(/report/images/a.png); --large-url: url(/report/images/a_width-1280.png)')
    expect(styles).toEqual(['.a{background:url("/report/images/b.png")}'])
  })

  it('collects inline styles and drops comments and ref attributes', () => {
    const result = prepareArticleHtml('<!-- x --><div ref="wrapper"><style>.a{color:red}</style><p>t</p></div>', ctx)
    expect(result.styles).toEqual(['.a{color:red}'])
    expect(result.nodes).toEqual([{ t: 'html', tag: 'div', attrs: {}, html: '<p>t</p>' }])
  })

  it('supports scoped slots and bindings of the accordion', () => {
    const { nodes, warnings } = prepareArticleHtml(
      `<srl-category-accordion v-slot="{ accordion }" id="note-0" class="acc">
        <srl-category-accordion-toggle :accordion="accordion" :level="0">T</srl-category-accordion-toggle>
        <srl-category-accordion-content :accordion="accordion"><p>C</p></srl-category-accordion-content>
      </srl-category-accordion>`,
      ctx,
    )
    expect(warnings).toEqual([])
    const [accordion, toggle, content] = components(nodes)
    expect(accordion).toMatchObject({ attrs: { id: 'note-0', class: 'acc' }, slots: { default: { scope: { names: ['accordion'] } } } })
    expect(toggle).toMatchObject({ bind: { accordion: { ref: ['accordion'] }, level: { lit: 0 } } })
    expect(content!.slots.default!.children).toEqual([{ t: 'html', tag: 'p', attrs: {}, html: 'C' }])
  })

  it('maps <template-x> to named slots', () => {
    const { nodes } = prepareArticleHtml('<srl-x><template-head v-slot="s"><b>H</b></template-head><i>B</i></srl-x>', ctx)
    expect(components(nodes)[0]!.slots).toEqual({
      head: { scope: { name: 's' }, children: [{ t: 'html', tag: 'b', attrs: {}, html: 'H' }] },
      default: { children: [{ t: 'html', tag: 'i', attrs: {}, html: 'B' }] },
    })
  })

  it('keeps line breaks of spans in table cells', () => {
    const { nodes } = prepareArticleHtml('<table><tbody><tr><td><span>a\nb</span></td></tr></tbody></table>', ctx)
    expect(allHtml(nodes)).toContain('<span>a<br>b</span>')
  })

  it('warns about unsupported Vue syntax', () => {
    const { warnings } = prepareArticleHtml('<srl-x v-if="a" :b="a + 1" @click="c"></srl-x><p :x="y">p</p>', ctx)
    expect(warnings).toHaveLength(4)
  })
})

describe('extractSearchText', () => {
  it('collects h1-h3 and p text', () => {
    expect(extractSearchText('<h1>Title</h1><div><p>One <b>two</b></p><h4>no</h4><h3> three\n four </h3></div>')).toBe(
      'Title One two three four',
    )
  })
})

const fixtures = resolve(__dirname, '../../../fixtures/data')
describeIf(existsSync(join(fixtures, 'base')))('prepareArticleHtml over all fixture articles', () => {
  const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'))
  const settings = json(join(fixtures, 'base/json/settings.json'))
  const fixtureTable = buildRouteTable({
    settings,
    routing: Object.fromEntries(
      settings.languages.map((l: string) => [l, json(join(fixtures, `nav-nested/json/routing_${l}.json`))]),
    ),
  })
  const knownTags = new Set([
    'srl-article-dialog-button',
    'srl-ld-table',
    'srl-ld-search',
    'srl-ld-download-center',
    'srl-category-accordion',
    'srl-category-accordion-toggle',
    'srl-category-accordion-content',
    'srl-article-accordion',
  ])

  for (const locale of settings.languages as string[]) {
    const dir = join(fixtures, 'base/html', locale)
    it(`${locale}: all ${readdirSync(dir).length} articles prepare cleanly`, () => {
      const unresolved = new Set<string>()
      for (const file of readdirSync(dir)) {
        const result = prepareArticleHtml(readFileSync(join(dir, file), 'utf8'), {
          table: fixtureTable,
          locale,
          base: '/report/',
        })
        expect(result.warnings, file).toEqual([])
        for (const component of components(result.nodes)) expect(knownTags, file).toContain(component.tag)
        const html = allHtml(result.nodes)
        expect(html, file).not.toMatch(/(src|srcset|href)\\?"?[:=]\\?"\.\/images\//)
        result.unresolvedLinks.forEach((l) => unresolved.add(l))
      }
      // only links whose target does not exist in the data stay unresolved
      for (const link of unresolved) expect(link).toMatch(/^\.\/[a-z]{2}\//)
    })
  }
})
