import { useRuntimeConfig, useStorage } from 'nitropack/runtime'
import { assembleManifest, loadRawData, type SrlManifest, type SrlRawData } from '../../../shared/manifest'

const STORAGES: Record<string, string> = {
  json: 'assets:srl-json',
  html: 'assets:srl-html',
  downloads: 'assets:srl-downloads',
}

/** Reads a file of the data folder ("json/settings.json", "html/en/Home.html") from the server assets. */
export async function readDataFile(path: string): Promise<unknown> {
  const [folder = '', ...rest] = path.split('/')
  const storage = STORAGES[folder]
  if (!storage) throw new Error(`Unknown data folder "${folder}"`)
  const value = await useStorage(storage).getItem(rest.join(':'))
  if (value === null || value === undefined) throw new Error(`Data file not found: ${path}`)
  return value
}

let cached: Promise<SrlManifest> | undefined

/** Raw data (settings, translations, routing, downloads) as delivered by /_srl/manifest.json. */
export async function getRawData(): Promise<SrlRawData> {
  const { settings, translations, routing, downloads } = await getManifest()
  return { settings, translations, routing, downloads }
}

/** Manifest incl. route table. Cached in production, rebuilt on every request in dev (data can change). */
export function getManifest(): Promise<SrlManifest> {
  const build = () => {
    const { navigationMenu } = useRuntimeConfig().public.srl as { navigationMenu: string }
    return loadRawData(readDataFile).then((raw) => assembleManifest(raw, { navigationMenu }))
  }
  if (import.meta.dev) return build()
  cached ??= build().catch((error) => {
    cached = undefined
    throw error
  })
  return cached
}
