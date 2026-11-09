import { DIALOG_PATTERN } from '../dialog'
import { slugify as defaultSlugify } from '../slugify'
import type { NsWowArticle, NsWowMenu, NsWowRouting, NsWowSettings } from '../types'

/** Slug of the nswow article that is shown for unknown paths. */
export const NOT_FOUND_SLUG = '404'

export type RouteKind = 'index' | 'article' | 'special'

export interface Breadcrumb {
  label: string
  /** Missing for levels that could not be routed. */
  path?: string
}

export interface RouteEntry {
  locale: string
  uuid: string
  /** File name of the article HTML: html/<locale>/<name>.html */
  name: string
  slug: string
  title: string
  /** Absolute path without base, no trailing slash, e.g. /en/business-report/key-figures */
  path: string
  kind: RouteKind
  /** Component of a special page (Search, DownloadCenter, ErrorView). */
  component?: string
  /** Navigation ancestors (empty for articles outside the navigation). */
  breadcrumbs: Breadcrumb[]
}

export interface DialogEntry {
  locale: string
  uuid: string
  name: string
  slug: string
  title: string
}

export type RouteIssueCode =
  | 'duplicate-slug'
  | 'path-collision'
  | 'duplicate-index'
  | 'duplicate-navigation-entry'
  | 'dialog-in-navigation'
  | 'unknown-page'
  | 'empty-menu-entry'
  | 'missing-routing'

export interface RouteIssue {
  code: RouteIssueCode
  locale: string
  message: string
  uuid?: string
  path?: string
}

export interface LocaleRouteTable {
  entries: RouteEntry[]
  byUuid: Record<string, RouteEntry>
  /** slug -> uuid (also for dialogs), first article wins. Used to resolve legacy links ./<locale>/<slug>. */
  bySlug: Record<string, string>
  dialogs: Record<string, DialogEntry>
  index?: RouteEntry
  /**
   * Page shown for unknown paths of this locale: the article with the slug `404`, otherwise the
   * special page `ErrorView`.
   */
  notFound?: RouteEntry
}

export interface RouteTable {
  locales: string[]
  defaultLocale: string
  /** Absolute path -> entry, over all locales. */
  byPath: Record<string, RouteEntry>
  /** Redirect source path -> target path (navigation levels without article, `/`). */
  redirects: Record<string, string>
  /** uuid -> locale -> path, for language switch and hreflang. */
  alternates: Record<string, Record<string, string>>
  locale: Record<string, LocaleRouteTable>
  issues: RouteIssue[]
}

export interface RouteTableInput {
  settings: Pick<NsWowSettings, 'languages' | 'defaultLanguage'>
  routing: Record<string, NsWowRouting | undefined>
}

export interface RouteTableOptions {
  /** Name of the menu whose hierarchy defines the URLs. */
  navigationMenu?: string
  dialogPattern?: RegExp
  slugify?: (label: string) => string
}

/**
 * Builds all routes from the nswow routing data. Pure function, used at build time
 * (generate, SSR) and in the browser (preview).
 *
 * Rules:
 * - Dialog articles (notes-<x>-<nr>) get no route.
 * - The index article is /<locale>.
 * - With a `navigation` menu, URLs follow its hierarchy: a MenuEntry without page adds its
 *   slugified label as segment and redirects to its first routed descendant, an Article adds its slug.
 * - All other articles are flat: /<locale>/<slug>.
 * - Collisions only produce issues: first come, first served.
 */
export function buildRouteTable(input: RouteTableInput, options: RouteTableOptions = {}): RouteTable {
  const navigationMenu = options.navigationMenu ?? 'navigation'
  const dialogPattern = options.dialogPattern ?? DIALOG_PATTERN
  const slugify = options.slugify ?? defaultSlugify

  const table: RouteTable = {
    locales: [],
    defaultLocale: input.settings.defaultLanguage,
    byPath: {},
    redirects: {},
    alternates: {},
    locale: {},
    issues: [],
  }

  for (const locale of input.settings.languages) {
    const routing = input.routing[locale]
    if (!routing) {
      table.issues.push({ code: 'missing-routing', locale, message: `No routing data for locale "${locale}".` })
      continue
    }
    table.locales.push(locale)
    table.locale[locale] = buildLocale(locale, routing, table, { navigationMenu, dialogPattern, slugify })
  }

  const defaultLocale = table.locales.includes(table.defaultLocale) ? table.defaultLocale : table.locales[0]
  if (defaultLocale) {
    table.defaultLocale = defaultLocale
    table.redirects['/'] = `/${defaultLocale}`
  }

  return table
}

interface LocaleContext {
  navigationMenu: string
  dialogPattern: RegExp
  slugify: (label: string) => string
}

function buildLocale(locale: string, routing: NsWowRouting, table: RouteTable, ctx: LocaleContext): LocaleRouteTable {
  const result: LocaleRouteTable = { entries: [], byUuid: {}, bySlug: {}, dialogs: {} }
  const pages = new Map<string, NsWowArticle>()
  const issue = (code: RouteIssueCode, message: string, extra: Partial<RouteIssue> = {}) =>
    table.issues.push({ code, locale, message, ...extra })

  for (const page of routing.pages) {
    if (pages.has(page.uuid)) continue
    pages.set(page.uuid, page)

    if (page.slug in result.bySlug) {
      issue('duplicate-slug', `Slug "${page.slug}" of "${page.uuid}" is already used by "${result.bySlug[page.slug]}".`, {
        uuid: page.uuid,
      })
    } else {
      result.bySlug[page.slug] = page.uuid
    }

    if (ctx.dialogPattern.test(page.uuid)) {
      result.dialogs[page.uuid] = {
        locale,
        uuid: page.uuid,
        name: page.name,
        slug: page.slug,
        title: page.translatedTitle,
      }
    }
  }

  const isDialog = (uuid: string) => uuid in result.dialogs

  /** Registers a route; returns the entry or undefined when the path is taken. */
  const addRoute = (page: NsWowArticle, path: string, breadcrumbs: Breadcrumb[]): RouteEntry | undefined => {
    const taken = table.byPath[path]?.uuid ?? (path in table.redirects ? 'a navigation level' : undefined)
    if (taken) {
      issue('path-collision', `Path "${path}" of "${page.uuid}" is already used by ${taken}.`, { uuid: page.uuid, path })
      return undefined
    }
    const entry: RouteEntry = {
      locale,
      uuid: page.uuid,
      name: page.name,
      slug: page.slug,
      title: page.translatedTitle,
      path,
      kind: page.index ? 'index' : page.component ? 'special' : 'article',
      ...(page.component ? { component: page.component } : {}),
      breadcrumbs,
    }
    table.byPath[path] = entry
    result.byUuid[page.uuid] = entry
    result.entries.push(entry)
    ;(table.alternates[page.uuid] ??= {})[locale] = path
    return entry
  }

  // 1. index article
  for (const page of pages.values()) {
    if (!page.index || isDialog(page.uuid)) continue
    if (result.index) {
      issue('duplicate-index', `"${page.uuid}" is marked as index, but "${result.index.uuid}" already is.`, {
        uuid: page.uuid,
      })
      continue
    }
    result.index = addRoute(page, `/${locale}`, [])
  }

  // 2. navigation hierarchy
  const walk = (items: NsWowMenu[], segments: string[], crumbs: Breadcrumb[]): string | undefined => {
    let firstPath: string | undefined
    for (const item of items) {
      let itemPath: string | undefined

      if (item.type === 'Article' && item.page) {
        const page = pages.get(item.page)
        if (!page) {
          issue('unknown-page', `Navigation entry "${item.label}" points to unknown page "${item.page}".`, {
            uuid: item.page,
          })
          continue
        }
        if (isDialog(page.uuid)) {
          issue('dialog-in-navigation', `Dialog article "${page.uuid}" in the navigation is ignored.`, { uuid: page.uuid })
          continue
        }
        const childSegments = page.index ? segments : [...segments, page.slug]
        const existing = result.byUuid[page.uuid]
        if (existing && !page.index) {
          issue('duplicate-navigation-entry', `"${page.uuid}" appears more than once in the navigation; the first entry wins.`, {
            uuid: page.uuid,
            path: existing.path,
          })
          itemPath = existing.path
        } else {
          itemPath = existing?.path ?? addRoute(page, `/${[locale, ...childSegments].join('/')}`, crumbs)?.path
        }
        if (item.submenuEntries?.length) {
          const crumb = { label: page.translatedTitle, ...(itemPath ? { path: itemPath } : {}) }
          walk(item.submenuEntries, childSegments, [...crumbs, crumb])
        }
      } else if (item.type === 'MenuEntry' && !item.page) {
        const levelSegments = [...segments, ctx.slugify(item.label)]
        const levelPath = `/${[locale, ...levelSegments].join('/')}`
        const levelCrumbs = [...crumbs, { label: item.label, path: levelPath }]
        const target = walk(item.submenuEntries ?? [], levelSegments, levelCrumbs)
        if (!target) {
          issue('empty-menu-entry', `Navigation level "${item.label}" has no routed article and gets no URL.`, {
            path: levelPath,
          })
          continue
        }
        if (table.byPath[levelPath] || levelPath in table.redirects) {
          issue('path-collision', `Navigation level "${item.label}" (${levelPath}) collides with an existing path.`, {
            path: levelPath,
          })
        } else {
          table.redirects[levelPath] = target
        }
        itemPath = target
      }
      // ExternalLink and unknown entry types get no route

      firstPath ??= itemPath
    }
    return firstPath
  }

  const navigation = routing.menu?.[ctx.navigationMenu]
  if (navigation?.length) {
    walk(navigation, [], [])
  }

  // 3. everything else is flat
  for (const page of pages.values()) {
    if (isDialog(page.uuid) || result.byUuid[page.uuid] || page.index) continue
    addRoute(page, `/${locale}/${page.slug}`, [])
  }

  // 4. 404 page: an article with the slug "404" wins over the special page ErrorView
  result.notFound =
    result.entries.find((entry) => entry.slug === NOT_FOUND_SLUG && entry.kind !== 'special') ??
    result.entries.find((entry) => entry.component === 'ErrorView')

  return result
}
