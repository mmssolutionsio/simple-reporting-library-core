// SRL 1 composable names (`import { useConfig } from '#composables'`), used by the livingdocs
// Vue files and migrated project code. Thin wrappers around the useSrl* composables; not
// auto-imported. Call them in setup like in SRL 1 (they need the Nuxt app context).
import { useRuntimeConfig } from '#imports'
import { computed, type ComputedRef } from 'vue'
import type { NsWowArticle, NsWowDownload, NsWowMenu, NsWowSettings, NsWowTranslations } from '../../shared/types'
import type { SrlNavigationItem } from '../utils/menu'
import type { LanguageSwitch } from '../utils/navigation'
import { useSrlDownloads, useSrlLanguageSwitch, useSrlMenu } from '../composables/navigation'
import { useSrlSearch } from '../composables/search'
import { useSrlArticles, useSrlCurrentArticle, useSrlLocale, useSrlManifest } from '../composables/srl'
import { useSrlViewport, type SrlViewport } from '../composables/viewport'

export interface NsWowConfig {
  locale: string
  base: string
  settings: NsWowSettings
  articles: Record<string, NsWowArticle[]>
  menus: Record<string, Record<string, NsWowMenu[]>>
  translations: NsWowTranslations
  downloads: Record<string, { structure: NsWowDownload[] }>
}

/** SRL 1 search list item (search.vue reads `words` and `article`). */
export interface NsWowSearchList {
  article: NsWowArticle
  href: string
  words: string
}

export function useConfig(): ComputedRef<NsWowConfig> {
  const manifest = useSrlManifest()
  const locale = useSrlLocale(manifest)
  const base = useRuntimeConfig().app.baseURL
  return computed(() => ({
    locale: locale.value,
    base,
    settings: manifest.settings,
    articles: Object.fromEntries(Object.entries(manifest.routing).map(([loc, routing]) => [loc, routing.pages])),
    menus: Object.fromEntries(Object.entries(manifest.routing).map(([loc, routing]) => [loc, routing.menu])),
    translations: manifest.translations,
    downloads: Object.fromEntries(
      Object.entries(manifest.downloads).map(([loc, downloads]) => [loc, { structure: downloads?.structure ?? [] }]),
    ),
  }))
}

export function useSettings(): ComputedRef<NsWowSettings> {
  const manifest = useSrlManifest()
  return computed(() => manifest.settings)
}

export const useLocale = (): ComputedRef<string> => useSrlLocale()
export const useArticles = (): ComputedRef<NsWowArticle[]> => useSrlArticles()
export const useArticle = (): ComputedRef<NsWowArticle | undefined> => useSrlCurrentArticle()
export const useMenu = (name: string): ComputedRef<SrlNavigationItem[]> => useSrlMenu(name)
export const useDownloads = (): ComputedRef<NsWowDownload[]> => useSrlDownloads()
export const useViewPort = (): ComputedRef<SrlViewport> => useSrlViewport()

export function useLanguageSwitch(): ComputedRef<{ current: { label: string; href: string }; items: SrlNavigationItem[] }> {
  const languageSwitch = useSrlLanguageSwitch()
  return computed(() => {
    const value: LanguageSwitch = languageSwitch.value
    return {
      current: { label: value.current.label, href: value.current.href },
      items: value.items.map((item) => ({ label: item.label, href: item.href })),
    }
  })
}

/**
 * SRL 1: `const list = await useSearch()` → list of { article, href, words } of the current
 * locale. Resolves once the index is loaded (browser only; empty on the server).
 */
export async function useSearch(): Promise<ComputedRef<NsWowSearchList[]>> {
  const manifest = useSrlManifest()
  const { index, locale, load } = useSrlSearch({ immediate: false })
  const list = computed(() => {
    const pages = new Map((manifest.routing[locale.value]?.pages ?? []).map((page) => [page.uuid, page]))
    return (index.value ?? []).flatMap((entry) => {
      const article = pages.get(entry.uuid)
      return article ? [{ article, href: entry.path, words: entry.text }] : []
    })
  })
  await load()
  return list
}

export default {
  useConfig,
  useSettings,
  useLocale,
  useArticles,
  useArticle,
  useMenu,
  useDownloads,
  useViewPort,
  useLanguageSwitch,
  useSearch,
}
