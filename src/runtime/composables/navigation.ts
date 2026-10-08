import { useRoute, useRuntimeConfig } from '#imports'
import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import type { RouteEntry } from '../../shared/routes/buildRouteTable'
import type { NsWowDownload } from '../../shared/types'
import { buildMenuItems, type SrlNavigationItem } from '../utils/menu'
import {
  breadcrumbs,
  languageSwitch,
  prevNext,
  readingOrder,
  type BreadcrumbItem,
  type LanguageSwitch,
} from '../utils/navigation'
import { useSrlConfig, useSrlLocale, useSrlManifest } from './srl'

export type { SrlNavigationItem } from '../utils/menu'

/**
 * Items of an nswow menu (`navigation`, `menuMain`, `footerDownloads`, …) for SrlMenu: hrefs
 * resolved through the route table, `active` set for the current page and its ancestors.
 */
export function useSrlMenu(name: MaybeRefOrGetter<string>, locale?: MaybeRefOrGetter<string>): ComputedRef<SrlNavigationItem[]> {
  const manifest = useSrlManifest()
  const route = useRoute()
  const current = useSrlLocale(manifest)
  const base = useRuntimeConfig().app.baseURL
  return computed(() => {
    const loc = toValue(locale) ?? current.value
    return buildMenuItems(manifest.routing[loc]?.menu?.[toValue(name)], {
      table: manifest.table,
      locale: loc,
      currentPath: route.path,
      base,
    })
  })
}

/** Name of the main navigation menu: the configured navigation menu if it has entries, else `menuMain`. */
export function useSrlMainMenuName(): ComputedRef<string> {
  const manifest = useSrlManifest()
  const locale = useSrlLocale(manifest)
  const { navigationMenu } = useSrlConfig()
  return computed(() => (manifest.routing[locale.value]?.menu?.[navigationMenu]?.length ? navigationMenu : 'menuMain'))
}

/** Main navigation: the navigation menu if present, else `menuMain` (SRL 1). */
export function useSrlMainMenu(): ComputedRef<SrlNavigationItem[]> {
  return useSrlMenu(useSrlMainMenuName())
}

/** Other languages of the current page (falls back to the index page of a locale without translation). */
export function useSrlLanguageSwitch(): ComputedRef<LanguageSwitch> {
  const manifest = useSrlManifest()
  const route = useRoute()
  const locale = useSrlLocale(manifest)
  return computed(() => languageSwitch(manifest.table, route.path, locale.value))
}

/** Navigation ancestors of the current page plus the page itself. */
export function useSrlBreadcrumbs(): ComputedRef<BreadcrumbItem[]> {
  const manifest = useSrlManifest()
  const route = useRoute()
  return computed(() => breadcrumbs(manifest.table, route.path))
}

/**
 * Previous/next page in reading order: depth-first order of the navigation menu (the
 * configured one, else `menuMain`), or the routing order when there is no menu. Cyclic like SRL 1.
 */
export function useSrlPrevNext(options: { cyclic?: boolean } = {}): ComputedRef<{ prev?: RouteEntry; next?: RouteEntry }> {
  const manifest = useSrlManifest()
  const route = useRoute()
  const locale = useSrlLocale(manifest)
  const menuName = useSrlMainMenuName()
  const order = computed(() =>
    readingOrder(manifest.table, locale.value, manifest.routing[locale.value]?.menu?.[menuName.value]),
  )
  return computed(() => {
    const { prev, next } = prevNext(order.value, route.path, options)
    return { prev, next }
  })
}

/** Download center structure of a locale (downloads/downloads_<locale>.json). */
export function useSrlDownloads(locale?: MaybeRefOrGetter<string>): ComputedRef<NsWowDownload[]> {
  const manifest = useSrlManifest()
  const current = useSrlLocale(manifest)
  return computed(() => manifest.downloads[toValue(locale) ?? current.value]?.structure ?? [])
}

export interface SrlDownloadItem extends NsWowDownload {
  /** URL of the file incl. base. */
  href?: string
}

export interface SrlDownloadGroup {
  title: string | null
  items: SrlDownloadItem[]
}

/** Downloads grouped by their section titles, with file URLs (SRL 1 download-center logic). */
export function useSrlDownloadGroups(locale?: MaybeRefOrGetter<string>): ComputedRef<SrlDownloadGroup[]> {
  const manifest = useSrlManifest()
  const current = useSrlLocale(manifest)
  const base = useRuntimeConfig().app.baseURL
  return computed(() => {
    const loc = toValue(locale) ?? current.value
    const groups: SrlDownloadGroup[] = []
    let group: SrlDownloadGroup | undefined
    for (const item of manifest.downloads[loc]?.structure ?? []) {
      if (item.type === 'sectionTitle') {
        group = { title: item.title, items: [] }
        groups.push(group)
      } else if (item.type === 'artifact') {
        if (!group) groups.push((group = { title: null, items: [] }))
        group.items.push({ ...item, href: item.artifact ? `${base}downloads/${loc}/${item.artifact}` : undefined })
      }
    }
    return groups
  })
}
