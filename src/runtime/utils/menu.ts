// Pure menu logic (no Nuxt, no DOM): nswow menus -> navigation items with resolved hrefs.
import { resolveLink } from '../../shared/links/resolveLink'
import type { RouteTable } from '../../shared/routes/buildRouteTable'
import type { NsWowMenu } from '../../shared/types'
import { isExternalPath, isFilePath, isRouterPath } from '../../shared/uri'

export interface SrlImage {
  src: string
  alt?: string
}

/**
 * Item of a rendered menu (SRL 1: NsWowNavigationItem). `svg*` accept an SVG string
 * (markup or data URI), an URL (loaded in the browser) or a component/VNode.
 */
export interface SrlNavigationItem {
  label: string
  title?: string
  iconPrefix?: string
  icon?: string
  iconBefore?: string
  iconAfter?: string
  svg?: string | object
  svgBefore?: string | object
  svgAfter?: string | object
  img?: SrlImage
  imgBefore?: SrlImage
  imgAfter?: SrlImage
  active?: boolean
  /** Route path (without base, may contain #anchor) for internal targets, absolute URL otherwise. */
  href?: string
  attributes?: Record<string, string>
  callback?: (element: HTMLAnchorElement | HTMLButtonElement, listElement: HTMLLIElement, menu?: HTMLUListElement) => void
  children?: SrlNavigationItem[]
  /** uuid of the target article (Article entries). */
  uuid?: string
  /** Menu entry type of the source data (Article, MenuEntry, ExternalLink). */
  type?: string
}

export interface BuildMenuOptions {
  table: RouteTable
  locale: string
  /** Current route path without base, e.g. /en/business-report/key-figures. */
  currentPath?: string
  /** app.baseURL, used for file links (./downloads/…). Default `/`. */
  base?: string
}

/** Normalizes a route path for comparisons: no hash/query, no trailing slash. */
export function normalizePath(path: string): string {
  const clean = path.split(/[?#]/)[0] ?? ''
  return clean.length > 1 ? clean.replace(/\/+$/, '') : clean
}

function withHash(path: string, hash?: string): string {
  return hash ? `${path}#${hash}` : path
}

/** Resolves the target of a single menu entry (without children). */
export function resolveMenuHref(item: NsWowMenu, options: BuildMenuOptions): string | undefined {
  const { table, locale } = options
  const base = options.base ?? '/'
  if (item.page) {
    const entry = table.locale[locale]?.byUuid[item.page]
    return entry ? withHash(entry.path, item.anchor || undefined) : undefined
  }
  if (item.type === 'ExternalLink' && item.url) {
    const url = item.url
    if (isExternalPath(url)) return url
    if (isFilePath(url)) return url.startsWith('./') || url.startsWith('/') ? base + url.replace(/^\.?\//, '') : url
    if (isRouterPath(url)) {
      const resolved = resolveLink(url, {}, table, locale)
      if (resolved.type === 'route') return withHash(resolved.path, resolved.hash || undefined)
      return url.startsWith('.') ? url.slice(1) : url
    }
    return url
  }
  return undefined
}

/**
 * Builds navigation items from an nswow menu.
 * - Article: path from the route table (+ #anchor)
 * - MenuEntry without page: href of its first descendant with a target (same as the redirect
 *   of a navigation level)
 * - ExternalLink: absolute URLs as they are, legacy ./<locale>/<slug> links through the route
 *   table, file links prefixed with the base
 * - active: the item's path equals the current path, or one of its children is active
 */
export function buildMenuItems(menu: NsWowMenu[] | undefined, options: BuildMenuOptions): SrlNavigationItem[] {
  const current = options.currentPath === undefined ? undefined : normalizePath(options.currentPath)

  const build = (item: NsWowMenu): SrlNavigationItem => {
    const result: SrlNavigationItem = { label: item.label, type: item.type, active: false }
    const href = resolveMenuHref(item, options)
    if (item.page) result.uuid = item.page
    if (href) {
      result.href = href
      result.active = current !== undefined && isRouterPath(href) && normalizePath(href) === current
    }
    const children = (item.submenuEntries ?? []).map(build)
    if (children.length) {
      result.children = children
      if (children.some((child) => child.active)) result.active = true
      if (!result.href) {
        const first = firstHref(children)
        if (first) result.href = first
      }
    }
    return result
  }

  return (menu ?? []).map(build)
}

function firstHref(items: SrlNavigationItem[]): string | undefined {
  for (const item of items) {
    if (item.href) return item.href
    const nested = item.children ? firstHref(item.children) : undefined
    if (nested) return nested
  }
  return undefined
}

/** Active trail: the active item of every level, from top to bottom. */
export function activeTrail(items: SrlNavigationItem[]): SrlNavigationItem[] {
  const trail: SrlNavigationItem[] = []
  let level: SrlNavigationItem[] | undefined = items
  while (level) {
    const active: SrlNavigationItem | undefined = level.find((item) => item.active)
    if (!active) break
    trail.push(active)
    level = active.children
  }
  return trail
}
