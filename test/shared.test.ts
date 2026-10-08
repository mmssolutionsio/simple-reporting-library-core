import { describe, expect, it } from 'vitest'
import { buildRouteTable, isDialogArticle, resolveLink, slugify, type NsWowRouting } from '../src/shared'

describe('slugify', () => {
  it.each([
    ['Business Report', 'business-report'],
    ['Vergütungsbericht', 'verguetungsbericht'],
    ['Ökologie & Umwelt', 'oekologie-umwelt'],
    ['Straße / Größe', 'strasse-groesse'],
    ['  Café — Crème brûlée  ', 'cafe-creme-brulee'],
    ['ÄÖÜ', 'aeoeue'],
    ['2030: Highlights!', '2030-highlights'],
  ])('%s -> %s', (label, slug) => {
    expect(slugify(label)).toBe(slug)
  })
})

describe('isDialogArticle', () => {
  it.each([
    ['notes-group-12', true],
    ['notes-holding-3', true],
    ['notes-group-0', true],
    ['notes_group', false],
    ['notes_holding', false],
    ['05-05-notes-to-the-consolidated-financial-statements', false],
    ['notes-group', false],
  ])('%s -> %s', (uuid, expected) => {
    expect(isDialogArticle(uuid)).toBe(expected)
  })
})

describe('resolveLink', () => {
  const page = (uuid: string, slug: string, extra = {}) => ({ uuid, name: uuid, slug, translatedTitle: uuid, index: false, ...extra })
  const routing = (labels: [string, string]): NsWowRouting => ({
    version: 'v1.0',
    pages: [page('home', 'home', { index: true }), page('kf', 'key-figures'), page('notes-group-1', 'net-sales'), page('other', 'other')],
    menu: { navigation: [{ label: labels[0], type: 'MenuEntry', submenuEntries: [{ label: labels[1], type: 'Article', page: 'kf' }] }] },
  })
  const table = buildRouteTable({
    settings: { languages: ['de', 'en'], defaultLanguage: 'en' },
    routing: { de: routing(['Bericht', 'Kennzahlen']), en: routing(['Report', 'Key Figures']) },
  })

  it('opens popup links as dialog', () => {
    expect(resolveLink('./en/net-sales', { articleName: 'notes-group-1', noteTarget: 'popup' }, table, 'en')).toEqual({
      type: 'dialog',
      uuid: 'notes-group-1',
      hash: '',
    })
  })

  it('prefers data-article-name and keeps the anchor', () => {
    expect(resolveLink('./en/whatever', { articleName: 'kf#section3.6' }, table, 'en')).toEqual({
      type: 'route',
      path: '/en/report/key-figures',
      hash: 'section3.6',
    })
  })

  it('maps legacy ./<locale>/<slug> links to the new nested URL', () => {
    expect(resolveLink('./en/key-figures', {}, table, 'en')).toEqual({ type: 'route', path: '/en/report/key-figures', hash: '' })
    expect(resolveLink('/de/key-figures#a', {}, table, 'en')).toEqual({ type: 'route', path: '/de/bericht/key-figures', hash: 'a' })
  })

  it('maps home and the locale root to the index', () => {
    expect(resolveLink('./en/home', {}, table, 'en')).toMatchObject({ type: 'route', path: '/en' })
    expect(resolveLink('./de', {}, table, 'en')).toMatchObject({ type: 'route', path: '/de' })
  })

  it('resolves links to dialog slugs as dialogs', () => {
    expect(resolveLink('./en/net-sales', {}, table, 'en')).toEqual({ type: 'dialog', uuid: 'notes-group-1', hash: '' })
  })

  it('resolves bare uuids', () => {
    expect(resolveLink('other#x', {}, table, 'de')).toEqual({ type: 'route', path: '/de/other', hash: 'x' })
  })

  it('accepts already resolved paths', () => {
    expect(resolveLink('/en/report/key-figures', {}, table, 'en')).toMatchObject({ type: 'route', path: '/en/report/key-figures' })
  })

  it('classifies anchors, external links, files and unknown targets', () => {
    expect(resolveLink('#top', {}, table, 'en')).toEqual({ type: 'anchor', hash: 'top' })
    expect(resolveLink('https://example.com', {}, table, 'en')).toEqual({ type: 'external', href: 'https://example.com' })
    expect(resolveLink('mailto:a@b.c', {}, table, 'en')).toMatchObject({ type: 'external' })
    expect(resolveLink('./downloads/en/report.pdf', {}, table, 'en')).toMatchObject({ type: 'file' })
    expect(resolveLink('./en/missing', {}, table, 'en')).toEqual({ type: 'unresolved', href: './en/missing' })
  })
})
