import semver from 'semver'

export interface InstalledPackage {
  name: string
  version: string
}

export interface UpdateInfo {
  name: string
  current: string
  latest: string
  type: 'major' | 'minor' | 'patch' | 'prerelease'
}

export type FetchLatest = (name: string) => Promise<string | undefined>

/** Latest version from the npm registry (undefined when offline / timeout). */
export const fetchLatestFromRegistry: FetchLatest = async (name) => {
  const registry = (process.env.npm_config_registry ?? 'https://registry.npmjs.org/').replace(/\/?$/, '/')
  try {
    const response = await fetch(`${registry}${name.replace('/', '%2F')}/latest`, { signal: AbortSignal.timeout(3000) })
    if (!response.ok) return undefined
    return ((await response.json()) as { version?: string }).version
  } catch {
    return undefined
  }
}

/** Compares installed versions with the registry using semver (SRL 1 missed minor/major updates). */
export async function checkUpdates(packages: InstalledPackage[], fetchLatest: FetchLatest = fetchLatestFromRegistry): Promise<UpdateInfo[]> {
  if (process.env.SRL_NO_UPDATE_CHECK === '1') return []
  const results = await Promise.all(
    packages.map(async ({ name, version }) => {
      const latest = await fetchLatest(name)
      if (!latest || !semver.valid(latest) || !semver.valid(version) || !semver.gt(latest, version)) return undefined
      const diff = semver.diff(version, latest)
      const type: UpdateInfo['type'] = diff === 'major' || diff === 'premajor' ? 'major' : diff === 'minor' || diff === 'preminor' ? 'minor' : diff === 'patch' || diff === 'prepatch' ? 'patch' : 'prerelease'
      return { name, current: version, latest, type }
    }),
  )
  return results.filter((r): r is UpdateInfo => !!r)
}
