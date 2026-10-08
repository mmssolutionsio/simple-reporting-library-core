import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { assembleManifest, loadRawData, type SrlManifest } from '../shared/manifest'
import type { RouteTableOptions } from '../shared/routes/buildRouteTable'

/** Reads data/ from disk (build time, CLI). Returns undefined when there is no data folder. */
export async function readManifestFromDisk(dataDir: string, options: RouteTableOptions = {}): Promise<SrlManifest | undefined> {
  if (!existsSync(join(dataDir, 'json/settings.json'))) return undefined
  const raw = await loadRawData(async (path) => JSON.parse(await readFile(join(dataDir, path), 'utf8')))
  return assembleManifest(raw, options)
}

/** Routes nuxt generate has to write: pages, redirects and the JSON endpoints. */
export function prerenderRoutes(manifest: SrlManifest): string[] {
  const { table } = manifest
  const routes = new Set<string>(['/_srl/manifest.json'])
  for (const path of Object.keys(table.byPath)) routes.add(path)
  for (const path of Object.keys(table.redirects)) routes.add(path)
  for (const locale of table.locales) {
    const localeTable = table.locale[locale]!
    routes.add(`/_srl/search/${locale}.json`)
    for (const uuid of [...Object.keys(localeTable.byUuid), ...Object.keys(localeTable.dialogs)]) {
      const kind = localeTable.byUuid[uuid]?.kind
      if (kind !== 'special') routes.add(`/_srl/article/${locale}/${encodeURIComponent(uuid)}.json`)
    }
  }
  return [...routes]
}
