// Pure navigation helpers (no Nuxt, no DOM): prev/next order, language switch, breadcrumbs.
import type { Breadcrumb, RouteEntry, RouteTable } from '../../shared/routes/buildRouteTable'
import type { NsWowMenu } from '../../shared/types'
import { normalizePath } from './menu'

/**
 * Route entry rendered for a path: the page itself, or for an unknown path the 404 page of its
 * locale (default locale for paths without one), as SrlPage renders it. Undefined for redirects
 * (navigation levels, `/`, legacy `/<locale>/<slug>` links) and when there is no 404 page.
 */
export function entryForPath(table: RouteTable, path: string): RouteEntry | undefined {
  const normalized = normalizePath(path)
  const entry = table.byPath[normalized]
  if (entry) return entry
  if (normalized in table.redirects) return undefined
  const [, locale = '', slug, ...rest] = normalized.split('/')
  const localeTable = table.locale[locale]
  const legacy = slug && !rest.length ? localeTable?.bySlug[slug] : undefined
  if (legacy && localeTable?.byUuid[legacy]) return undefined
  return (localeTable ?? table.locale[table.defaultLocale])?.notFound
}

/**
 * Reading order of a locale for prev/next.
 *
 * - With a navigation menu: depth-first order of its Article entries (same walk as the route
 *   builder; MenuEntry levels contribute their descendants, ExternalLinks and dialogs are skipped,
 *   each article once).
 * - Without one (flat URLs): the order of the route entries, i.e. index article first, then the
 *   routing order of nswow.
 * Special pages (Search, DownloadCenter, ErrorView) are never part of the order.
 */
export function readingOrder(table: RouteTable, locale: string, navigation?: NsWowMenu[]): RouteEntry[] {
  const localeTable = table.locale[locale]
  if (!localeTable) return []
  const usable = (entry: RouteEntry | undefined): entry is RouteEntry => !!entry && entry.kind !== 'special'

  if (!navigation?.length) return localeTable.entries.filter(usable)

  const seen = new Set<string>()
  const order: RouteEntry[] = []
  const walk = (items: NsWowMenu[]) => {
    for (const item of items) {
      if (item.page) {
        const entry = localeTable.byUuid[item.page]
        if (usable(entry) && !seen.has(entry.uuid)) {
          seen.add(entry.uuid)
          order.push(entry)
        }
      }
      if (item.submenuEntries?.length) walk(item.submenuEntries)
    }
  }
  walk(navigation)
  return order
}

export interface PrevNext {
  prev?: RouteEntry
  next?: RouteEntry
  index: number
}

/** Neighbours of `currentPath` in `order`. Cyclic (SRL 1 behaviour): the last page links to the first. */
export function prevNext(order: RouteEntry[], currentPath: string, options: { cyclic?: boolean } = {}): PrevNext {
  const cyclic = options.cyclic ?? true
  const path = normalizePath(currentPath)
  const index = order.findIndex((entry) => entry.path === path)
  if (index === -1 || order.length < 2) return { index }
  const last = order.length - 1
  return {
    index,
    prev: index > 0 ? order[index - 1] : cyclic ? order[last] : undefined,
    next: index < last ? order[index + 1] : cyclic ? order[0] : undefined,
  }
}

export interface LanguageSwitchItem {
  /** Locale code, e.g. `de`. */
  label: string
  locale: string
  /** Route path (without base). */
  href: string
  active: boolean
  /** false when the page has no translation and href points to the index of that locale. */
  translated: boolean
}

export interface LanguageSwitch {
  current: LanguageSwitchItem
  /** All other locales. */
  items: LanguageSwitchItem[]
  /** All locales incl. the current one, in settings order. */
  all: LanguageSwitchItem[]
}

/**
 * Language switch for the current page: same article in the other locale (route table
 * alternates), otherwise the index page of that locale.
 */
export function languageSwitch(table: RouteTable, currentPath: string, currentLocale: string): LanguageSwitch {
  const entry = entryForPath(table, currentPath)
  const alternates = entry ? (table.alternates[entry.uuid] ?? {}) : {}
  const all = table.locales.map((locale): LanguageSwitchItem => {
    const translated = locale in alternates
    const href = alternates[locale] ?? table.locale[locale]?.index?.path ?? `/${locale}`
    return { label: locale, locale, href, active: locale === currentLocale, translated }
  })
  const current = all.find((item) => item.active) ?? {
    label: currentLocale,
    locale: currentLocale,
    href: `/${currentLocale}`,
    active: true,
    translated: false,
  }
  return { current, items: all.filter((item) => !item.active), all }
}

export interface BreadcrumbItem extends Breadcrumb {
  current: boolean
}

/** Navigation ancestors of the current page plus the page itself. */
export function breadcrumbs(table: RouteTable, currentPath: string): BreadcrumbItem[] {
  const entry = entryForPath(table, currentPath)
  if (!entry) return []
  return [
    ...entry.breadcrumbs.map((crumb) => ({ ...crumb, current: false })),
    { label: entry.title, path: entry.path, current: true },
  ]
}
