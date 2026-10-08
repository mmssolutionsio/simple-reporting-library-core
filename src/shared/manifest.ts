import { buildRouteTable, type RouteTable, type RouteTableOptions } from './routes/buildRouteTable'
import type { NsWowDownloads, NsWowRouting, NsWowSettings, NsWowTranslations } from './types'

/** Everything the app needs from data/json and data/downloads, plus the derived route table. */
export interface SrlManifest {
  settings: NsWowSettings
  translations: NsWowTranslations
  routing: Record<string, NsWowRouting>
  downloads: Record<string, NsWowDownloads | undefined>
  table: RouteTable
}

export type SrlRawData = Omit<SrlManifest, 'table'>

/** Reads the nswow data through `read` (fs at build time, storage on the server, fetch in the preview). */
export async function loadRawData(read: (path: string) => Promise<unknown>): Promise<SrlRawData> {
  const settings = (await read('json/settings.json')) as NsWowSettings | undefined
  if (!settings?.languages?.length) {
    throw new Error('json/settings.json is missing or has no languages.')
  }
  const optional = (path: string) => read(path).catch(() => undefined)
  const translations = ((await optional('json/translations_hosting.json')) ?? {}) as NsWowTranslations
  const routing: Record<string, NsWowRouting> = {}
  const downloads: Record<string, NsWowDownloads | undefined> = {}
  await Promise.all(
    settings.languages.map(async (locale) => {
      const localeRouting = (await optional(`json/routing_${locale}.json`)) as NsWowRouting | undefined
      if (localeRouting) routing[locale] = localeRouting
      downloads[locale] = (await optional(`downloads/downloads_${locale}.json`)) as NsWowDownloads | undefined
    }),
  )
  return { settings, translations, routing, downloads }
}

export function assembleManifest(raw: SrlRawData, options: RouteTableOptions = {}): SrlManifest {
  return { ...raw, table: buildRouteTable({ settings: raw.settings, routing: raw.routing }, options) }
}

/** File of an article HTML relative to the data folder. */
export function articleHtmlPath(locale: string, name: string): string {
  return `html/${locale}/${name}.html`
}
