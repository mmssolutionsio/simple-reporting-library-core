import { useAsyncData, useNuxtApp, useRoute, useRuntimeConfig } from '#imports'
import { computed, type ComputedRef } from 'vue'
import type { PreparedArticle } from '../../shared/html/nodes'
import { loadPreviewArticle } from '../utils/preview'
import type { SrlManifest } from '../../shared/manifest'
import type { DialogEntry, RouteEntry } from '../../shared/routes/buildRouteTable'
import type { NsWowArticle } from '../../shared/types'
import { normalizePath } from '../utils/menu'

export interface SrlArticleData extends PreparedArticle {
  uuid: string
  locale: string
  title: string
}

export interface SrlPublicConfig {
  mode: 'static' | 'preview'
  navigationMenu: string
  /** Grid breakpoints (from srl.config once M7 is wired), used by useSrlViewport. */
  breakpoints?: Record<string, number>
}

export function useSrlConfig(): SrlPublicConfig {
  return useRuntimeConfig().public.srl as SrlPublicConfig
}

/** Settings, translations, routing, downloads and route table (loaded once by the srl-data plugin). */
export function useSrlManifest(): SrlManifest {
  return useNuxtApp().$srlManifest as SrlManifest
}

export type SrlResolvedPage =
  | { type: 'page'; entry: RouteEntry }
  | { type: 'redirect'; to: string }
  | { type: 'not-found' }

/**
 * Maps a path (without base) to its route entry or redirect. Legacy SRL 1 URLs
 * `/<locale>/<slug>` of articles that now live deeper in the navigation redirect to the new path.
 */
export function resolveSrlPath(manifest: SrlManifest, path: string): SrlResolvedPage {
  const normalized = normalizePath(path)
  const redirect = manifest.table.redirects[normalized]
  if (redirect) return { type: 'redirect', to: redirect }
  const entry = manifest.table.byPath[normalized]
  if (entry) return { type: 'page', entry }

  const [, locale = '', slug, ...rest] = normalized.split('/')
  const localeTable = manifest.table.locale[locale]
  const uuid = slug && !rest.length ? localeTable?.bySlug[slug] : undefined
  const legacy = uuid ? localeTable?.byUuid[uuid] : undefined
  return legacy ? { type: 'redirect', to: legacy.path } : { type: 'not-found' }
}

/**
 * Loads a prepared article (or dialog article). One request per article and app instance;
 * the single place that knows the data URL (the preview data source hooks in here).
 */
export function fetchSrlArticle(locale: string, uuid: string): Promise<SrlArticleData> {
  const nuxtApp = useNuxtApp() as unknown as { _srlArticles?: Map<string, Promise<SrlArticleData>> }
  const cache = (nuxtApp._srlArticles ??= new Map())
  const key = `${locale}/${uuid}`
  let request = cache.get(key)
  if (!request) {
    request =
      useSrlConfig().mode === 'preview'
        ? loadPreviewArticle(useSrlManifest(), useRuntimeConfig().app.baseURL, locale, uuid)
        : $fetch<SrlArticleData>(`/_srl/article/${locale}/${encodeURIComponent(uuid)}.json`)
    request.catch(() => cache.delete(key))
    cache.set(key, request)
  }
  return request
}

/** Prepared article content of a page (part of the page payload). */
export async function useSrlArticle(article: RouteEntry | DialogEntry) {
  const key = `srl-article-${article.locale}-${article.uuid}`
  const { data } = await useAsyncData(key, () => fetchSrlArticle(article.locale, article.uuid))
  return data
}

/** Locale of the current route (first path segment), falling back to the default locale. */
export function useSrlLocale(manifest: SrlManifest = useSrlManifest()): ComputedRef<string> {
  const route = useRoute()
  return computed(() => {
    const first = route.path.split('/')[1] ?? ''
    return manifest.table.locales.includes(first) ? first : manifest.table.defaultLocale
  })
}

/** Route entry of the current page (undefined on unknown paths). */
export function useSrlCurrentEntry(): ComputedRef<RouteEntry | undefined> {
  const manifest = useSrlManifest()
  const route = useRoute()
  return computed(() => manifest.table.byPath[normalizePath(route.path)])
}

/** nswow articles (routing pages) of a locale, default: current locale. */
export function useSrlArticles(locale?: string): ComputedRef<NsWowArticle[]> {
  const manifest = useSrlManifest()
  const current = useSrlLocale(manifest)
  return computed(() => manifest.routing[locale ?? current.value]?.pages ?? [])
}

/** nswow article of the current page. */
export function useSrlCurrentArticle(): ComputedRef<NsWowArticle | undefined> {
  const manifest = useSrlManifest()
  const entry = useSrlCurrentEntry()
  return computed(() => {
    const current = entry.value
    return current ? manifest.routing[current.locale]?.pages.find((page) => page.uuid === current.uuid) : undefined
  })
}
