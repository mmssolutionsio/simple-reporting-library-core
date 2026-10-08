import type { RouteTable } from '../routes/buildRouteTable'
import { isExternalPath, isFilePath } from '../uri'

export type ResolvedLink =
  | { type: 'route'; path: string; hash: string }
  | { type: 'dialog'; uuid: string; hash: string }
  | { type: 'anchor'; hash: string }
  | { type: 'external'; href: string }
  | { type: 'file'; href: string }
  | { type: 'unresolved'; href: string }

export interface LinkAttributes {
  /** data-article-name: uuid of the target article, optionally with #anchor */
  articleName?: string
  /** data-note-target="popup" marks links that open the target as dialog */
  noteTarget?: string
}

function splitHash(value: string): [string, string] {
  const index = value.indexOf('#')
  return index === -1 ? [value, ''] : [value.slice(0, index), value.slice(index + 1)]
}

/**
 * Resolves a link from the nswow HTML to its target in the route table.
 *
 * Order (as in SRL 1 srl/.srl/utils/html.ts): popup → data-article-name → ./<locale>/<slug> or
 * /<locale>/<slug> (home = index) → existing route path → bare uuid.
 */
export function resolveLink(href: string, attrs: LinkAttributes, table: RouteTable, locale: string): ResolvedLink {
  const byUuid = (uuid: string, hash: string, loc = locale): ResolvedLink | undefined => {
    const localeTable = table.locale[loc]
    if (!localeTable) return undefined
    if (uuid in localeTable.dialogs) return { type: 'dialog', uuid, hash }
    const entry = localeTable.byUuid[uuid]
    return entry ? { type: 'route', path: entry.path, hash } : undefined
  }

  if (attrs.noteTarget === 'popup') {
    const [uuid, hash] = splitHash(attrs.articleName || href)
    return { type: 'dialog', uuid, hash }
  }

  if (attrs.articleName) {
    const [uuid, hash] = splitHash(attrs.articleName)
    const resolved = byUuid(uuid, hash)
    if (resolved) return resolved
  }

  if (href.startsWith('#')) return { type: 'anchor', hash: href.slice(1) }
  if (isExternalPath(href)) return { type: 'external', href }
  if (isFilePath(href)) return { type: 'file', href }

  const [path, hash] = splitHash(href)
  if (path.startsWith('./') || path.startsWith('/')) {
    const clean = path.replace(/^\.?\//, '').replace(/\/+$/, '')
    const [loc = '', ...rest] = clean.split('/')
    const localeTable = table.locale[loc]
    if (localeTable) {
      const slug = rest.join('/')
      if (!slug || slug === 'home') {
        if (localeTable.index) return { type: 'route', path: localeTable.index.path, hash }
      } else if (rest.length === 1 && slug in localeTable.bySlug) {
        const resolved = byUuid(localeTable.bySlug[slug]!, hash, loc)
        if (resolved) return resolved
      }
    }
    const direct = table.byPath[`/${clean}`]
    if (direct) return { type: 'route', path: direct.path, hash }
    return { type: 'unresolved', href }
  }

  return byUuid(path, hash) ?? { type: 'unresolved', href }
}
