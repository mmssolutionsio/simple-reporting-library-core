// Preview mode (target `app`): the SPA reads the nswow data that lies next to the app
// (json/, html/, images/, downloads/) at runtime, on every page load, without cache.
import { articleHtmlPath, assembleManifest, loadRawData, type SrlManifest } from '../../shared/manifest'
import type { SrlSearchEntry } from './search'

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/')

export async function previewRead(base: string, path: string): Promise<unknown> {
  const response = await fetch(`${base}${encodePath(path)}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`${path}: ${response.status}`)
  return path.endsWith('.json') ? response.json() : response.text()
}

export async function loadPreviewManifest(base: string, navigationMenu: string): Promise<SrlManifest> {
  const raw = await loadRawData((path) => previewRead(base, path))
  return assembleManifest(raw, { navigationMenu })
}

/** Same result as /_srl/article/<locale>/<uuid>.json, prepared in the browser. */
export async function loadPreviewArticle(manifest: SrlManifest, base: string, locale: string, uuid: string) {
  const localeTable = manifest.table.locale[locale]
  const article = localeTable?.byUuid[uuid] ?? localeTable?.dialogs[uuid]
  if (!article) throw new Error(`Unknown article ${locale}/${uuid}`)
  const [html, { prepareArticleHtml }] = await Promise.all([
    previewRead(base, articleHtmlPath(locale, article.name)),
    import('../../shared/html/prepare'),
  ])
  return { uuid, locale, title: article.title, ...prepareArticleHtml(String(html), { table: manifest.table, locale, base }) }
}

/** Same result as /_srl/search/<locale>.json, built in the browser (SRL 1 did the same). */
export async function loadPreviewSearchIndex(manifest: SrlManifest, base: string, locale: string): Promise<SrlSearchEntry[]> {
  const { extractSearchText } = await import('../../shared/html/searchText')
  const pages = new Map((manifest.routing[locale]?.pages ?? []).map((page) => [page.uuid, page]))
  const entries = (manifest.table.locale[locale]?.entries ?? []).filter(
    (entry) => entry.kind !== 'special' && !pages.get(entry.uuid)?.ignoreInSearch,
  )
  return Promise.all(
    entries.map(async (entry) => {
      const html = await previewRead(base, articleHtmlPath(locale, entry.name)).catch(() => '')
      return { uuid: entry.uuid, path: entry.path, title: entry.title, text: extractSearchText(String(html)) }
    }),
  )
}
