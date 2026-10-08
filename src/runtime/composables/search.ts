import { useNuxtApp, useRuntimeConfig } from '#imports'
import { computed, getCurrentInstance, onMounted, ref, shallowReactive, toValue, type MaybeRefOrGetter } from 'vue'
import { searchIndex, type SrlSearchEntry, type SrlSearchOptions, type SrlSearchResult } from '../utils/search'
import { loadPreviewSearchIndex } from '../utils/preview'
import { useSrlConfig, useSrlLocale, useSrlManifest } from './srl'

export type { SrlSearchEntry, SrlSearchOptions, SrlSearchResult } from '../utils/search'

interface SearchStore {
  indexes: Record<string, SrlSearchEntry[]>
  requests: Record<string, Promise<SrlSearchEntry[]>>
}

function searchStore(): SearchStore {
  const nuxtApp = useNuxtApp() as unknown as { _srlSearch?: SearchStore }
  return (nuxtApp._srlSearch ??= shallowReactive({ indexes: {}, requests: {} }) as SearchStore)
}

/**
 * Full-text search over the prebuilt index /_srl/search/<locale>.json. The index is loaded in the
 * browser only (on mount, or on the first `load()`), so it never ends up in the page payload.
 */
export function useSrlSearch(options: { locale?: MaybeRefOrGetter<string>; immediate?: boolean } = {}) {
  const manifest = useSrlManifest()
  const current = useSrlLocale(manifest)
  const store = searchStore()
  const locale = computed(() => toValue(options.locale) ?? current.value)
  const pending = ref(false)
  const error = ref<unknown>()

  const index = computed<SrlSearchEntry[] | undefined>(() => store.indexes[locale.value])

  async function load(): Promise<SrlSearchEntry[]> {
    if (import.meta.server) return []
    const loc = locale.value
    if (store.indexes[loc]) return store.indexes[loc]
    pending.value = true
    error.value = undefined
    try {
      store.requests[loc] ??=
        useSrlConfig().mode === 'preview'
          ? loadPreviewSearchIndex(manifest, useRuntimeConfig().app.baseURL, loc)
          : $fetch<SrlSearchEntry[]>(`/_srl/search/${loc}.json`)
      const entries = await store.requests[loc]
      store.indexes = { ...store.indexes, [loc]: entries }
      return entries
    } catch (cause) {
      delete store.requests[loc]
      error.value = cause
      return []
    } finally {
      pending.value = false
    }
  }

  /** Matches like SRL 1; boldTheWord defaults to settings.search.boldTheWord. */
  function search(query: string, searchOptions: SrlSearchOptions = {}): SrlSearchResult[] {
    return searchIndex(index.value ?? [], query, {
      boldTheWord: manifest.settings.search?.boldTheWord ?? true,
      ...searchOptions,
    })
  }

  if (import.meta.client && options.immediate !== false) {
    if (getCurrentInstance()) onMounted(load)
    else void load()
  }

  return { locale, index, pending, error, load, search }
}
