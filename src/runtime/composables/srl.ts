import { useAsyncData, useNuxtApp, useRoute, useRuntimeConfig } from '#imports'
import { computed } from 'vue'
import type { PreparedArticle } from '../../shared/html/nodes'
import type { SrlManifest } from '../../shared/manifest'
import type { DialogEntry, RouteEntry } from '../../shared/routes/buildRouteTable'

export interface SrlArticleData extends PreparedArticle {
  uuid: string
  locale: string
  title: string
}

export function useSrlConfig() {
  return useRuntimeConfig().public.srl as { mode: 'static' | 'preview'; navigationMenu: string }
}

/** Settings, translations, routing, downloads and route table (loaded once by the srl-data plugin). */
export function useSrlManifest(): SrlManifest {
  return useNuxtApp().$srlManifest as SrlManifest
}

export type SrlResolvedPage =
  | { type: 'page'; entry: RouteEntry }
  | { type: 'redirect'; to: string }
  | { type: 'not-found' }

/** Maps a path (without base) to its route entry or redirect. */
export function resolveSrlPath(manifest: SrlManifest, path: string): SrlResolvedPage {
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path
  const redirect = manifest.table.redirects[normalized]
  if (redirect) return { type: 'redirect', to: redirect }
  const entry = manifest.table.byPath[normalized]
  return entry ? { type: 'page', entry } : { type: 'not-found' }
}

/** Prepared article (or dialog article) content. */
export async function useSrlArticle(article: RouteEntry | DialogEntry) {
  const key = `srl-article-${article.locale}-${article.uuid}`
  const { data } = await useAsyncData(key, () =>
    $fetch<SrlArticleData>(`/_srl/article/${article.locale}/${encodeURIComponent(article.uuid)}.json`),
  )
  return data
}

/** Locale of the current route (first path segment), falling back to the default locale. */
export function useSrlLocale(manifest: SrlManifest) {
  const route = useRoute()
  return computed(() => {
    const first = route.path.split('/')[1] ?? ''
    return manifest.table.locales.includes(first) ? first : manifest.table.defaultLocale
  })
}
