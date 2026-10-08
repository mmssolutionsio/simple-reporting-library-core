import { createError, defineEventHandler, getRouterParam } from 'h3'
import { extractSearchText } from '../../../shared/html/searchText'
import { articleHtmlPath } from '../../../shared/manifest'
import { getManifest, readDataFile } from '../utils/srlData'

export interface SrlSearchEntry {
  uuid: string
  path: string
  title: string
  text: string
}

/** /_srl/search/<locale>.json → text of all searchable articles (prebuilt index). */
export default defineEventHandler(async (event) => {
  const locale = (getRouterParam(event, 'file') ?? '').replace(/\.json$/, '')
  const manifest = await getManifest()
  const localeTable = manifest.table.locale[locale]
  if (!localeTable) throw createError({ statusCode: 404, statusMessage: `Unknown locale ${locale}` })

  const pages = new Map(manifest.routing[locale]!.pages.map((page) => [page.uuid, page]))
  const entries: SrlSearchEntry[] = []
  for (const entry of localeTable.entries) {
    if (entry.kind === 'special' || pages.get(entry.uuid)?.ignoreInSearch) continue
    const html = await readDataFile(articleHtmlPath(locale, entry.name)).catch(() => '')
    entries.push({ uuid: entry.uuid, path: entry.path, title: entry.title, text: extractSearchText(String(html)) })
  }
  return entries
})
