// @vitest-environment happy-dom
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseFragment, serialize } from 'parse5'
import { renderToString } from 'vue/server-renderer'
import { compile, createSSRApp, defineComponent, h, type Component } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { describeIf } from './describeIf'
import { buildRouteTable, prepareArticleHtml, type NsWowRouting } from '../src/shared'
import { createComponentResolver, SrlHtml } from '../src/shared/html/render'

// Minimal stand-ins with the same slot/prop contracts as the SRL components.
const passThrough = (name: string) =>
  defineComponent({ name, setup: (_, { slots }) => () => h('div', { 'data-c': name }, slots.default?.()) })

const stubs: Record<string, Component> = {
  'srl-category-accordion': defineComponent({
    name: 'SrlCategoryAccordion',
    setup: (_, { slots }) => () => h('div', { tabindex: '-1' }, slots.default?.({ accordion: { id: 'acc-1', state: false } })),
  }),
  'srl-category-accordion-toggle': defineComponent({
    name: 'SrlCategoryAccordionToggle',
    props: { accordion: { type: Object, required: true }, level: { type: Number, default: 0 } },
    setup: (props, { slots }) => () =>
      h(`h${Math.min(props.level + 2, 6)}`, [
        h('button', { 'aria-controls': (props.accordion as { id: string }).id }, slots.default?.()),
      ]),
  }),
  'srl-category-accordion-content': defineComponent({
    name: 'SrlCategoryAccordionContent',
    props: { accordion: { type: Object, required: true } },
    setup: (props, { slots }) => () => h('div', { id: (props.accordion as { id: string }).id }, slots.default?.()),
  }),
  'srl-ld-search': defineComponent({
    name: 'SrlLdSearch',
    props: { useAutoSearch: Boolean, useMoreResults: Boolean },
    setup: (props) => () => h('form', { 'data-auto': String(props.useAutoSearch), 'data-more': String(props.useMoreResults) }),
  }),
  'srl-article-dialog-button': defineComponent({
    name: 'SrlArticleDialogButton',
    props: { uuid: { type: String, required: true }, anchor: String },
    setup: (props, { slots }) => () => h('button', { 'data-uuid': props.uuid }, slots.default?.()),
  }),
  'srl-ld-table': passThrough('SrlLdTable'),
  'srl-ld-download-center': passThrough('SrlLdDownloadCenter'),
  'srl-article-accordion': passThrough('SrlArticleAccordion'),
}
const resolveStub = (tag: string) => stubs[tag]

/** Canonical HTML: parse + serialize, without comments (Vue fragment markers). */
const canonical = (html: string) => serialize(parseFragment(html.replace(/<!--[\s\S]*?-->/g, '')))

const page = (uuid: string, slug: string, extra = {}) => ({ uuid, name: uuid, slug, translatedTitle: uuid, index: false, ...extra })
const routing: NsWowRouting = {
  version: 'v1.0',
  pages: [page('home', 'home', { index: true }), page('notes-group-12', 'inventories')],
  menu: {},
}
const table = buildRouteTable({ settings: { languages: ['en'], defaultLanguage: 'en' }, routing: { en: routing } })

const SAMPLE = `<srl-category-accordion v-slot="{ accordion }" id="note-0" class="acc">
  <srl-category-accordion-toggle :accordion="accordion" class="head" :level="1"><span>Title</span></srl-category-accordion-toggle>
  <srl-category-accordion-content :accordion="accordion" class="content"><p>Text <a href="./en/inventories" data-article-name="notes-group-12" data-note-target="popup">12</a></p></srl-category-accordion-content>
</srl-category-accordion><srl-ld-search use-auto-search=""></srl-ld-search>`

describe('SrlHtml', () => {
  const prepared = prepareArticleHtml(SAMPLE, { table, locale: 'en', base: '/' })
  const app = () => createSSRApp({ render: () => h(SrlHtml, { nodes: prepared.nodes, resolve: resolveStub }) })

  it('renders components, scoped slots, bindings and fallthrough attributes on the server', async () => {
    const html = canonical(await renderToString(app()))
    expect(html).toContain('<div tabindex="-1" id="note-0" class="acc">')
    expect(html).toContain('<h3 class="head"><button aria-controls="acc-1"><span>Title</span></button></h3>')
    expect(html).toContain('<div id="acc-1" class="content"><p>Text <button data-uuid="notes-group-12" data-note-target="popup">12</button>')
    expect(html).toContain('<form data-auto="true" data-more="false"></form>')
  })

  it('hydrates without mismatches', async () => {
    const container = document.createElement('div')
    container.innerHTML = await renderToString(app())
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    app().mount(container)
    const messages = [...warn.mock.calls, ...error.mock.calls].flat().join('\n')
    warn.mockRestore()
    error.mockRestore()
    expect(messages).not.toMatch(/hydration|mismatch/i)
  })
})

// Acceptance criterion M4: the AST renderer produces the same DOM as the SRL 1 runtime
// template compiler (vue3-runtime-template) for every article of the test data.
const fixtures = resolve(__dirname, '../../../fixtures/data/base/html')
describeIf(existsSync(fixtures))('parity with the Vue template compiler (SRL 1)', () => {
  const srl1Template = (raw: string) =>
    raw
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/ ref="[^"]*"/g, '')
      // SRL 1 preserveTableCellLineBreaks
      .replace(/(<t[dh]\b[^>]*>)([\s\S]*?)(<\/t[dh]>)/gi, (_m, open: string, content: string, close: string) =>
        open +
        content.replace(/(<span\b[^>]*>)([\s\S]*?)(<\/span>)/gi, (span, so: string, sc: string, sx: string) =>
          /[\r\n]/.test(sc) ? so + sc.replace(/\r\n|\r|\n/g, '<br />') + sx : span,
        ) +
        close,
      )

  const renderCompiled = async (template: string) => {
    const app = createSSRApp({ render: compile(`<div>${template}</div>`) })
    for (const [tag, component] of Object.entries(stubs)) app.component(tag, component)
    return renderToString(app)
  }
  const renderAst = async (raw: string) => {
    const { nodes } = prepareArticleHtml(raw, { table, locale: 'en', base: '/', rewriteLinks: false })
    return renderToString(createSSRApp({ render: () => h('div', h(SrlHtml, { nodes, resolve: resolveStub })) }))
  }

  for (const locale of readdirSync(fixtures)) {
    it(`${locale}: every article renders identically`, async () => {
      const mismatches: string[] = []
      for (const file of readdirSync(join(fixtures, locale))) {
        const raw = readFileSync(join(fixtures, locale, file), 'utf8')
        const [expected, actual] = await Promise.all([renderCompiled(srl1Template(raw)), renderAst(raw)])
        if (canonical(expected) !== canonical(actual)) {
          mismatches.push(file)
          if (process.env.SRL_DIFF) {
            const a = canonical(expected), b = canonical(actual)
            let i = 0
            while (a[i] === b[i]) i++
            console.log(file, '\nEXPECTED:', a.slice(Math.max(0, i - 200), i + 200), '\nACTUAL:  ', b.slice(Math.max(0, i - 200), i + 200))
          }
        }
      }
      expect(mismatches).toEqual([])
    }, 60_000)
  }
})

describe('createComponentResolver', () => {
  it('resolves tags like Vue resolveComponent (digits after a hyphen)', () => {
    const hero = passThrough('SrlLdStartpage26Hero')
    const table = passThrough('SrlLdTable')
    const resolveTag = createComponentResolver({ 'srl-ld-startpage26-hero': hero, 'srl-ld-table': table })
    expect(resolveTag('srl-ld-table')).toBe(table)
    expect(resolveTag('srl-ld-startpage26-hero')).toBe(hero)
    expect(resolveTag('srl-ld-startpage-26-hero')).toBe(hero)
    expect(resolveTag('srl-ld-unknown')).toBeUndefined()
  })
})
