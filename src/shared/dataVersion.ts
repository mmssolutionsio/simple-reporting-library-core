/** Versions of the nswow data format (routing_<locale>.json / settings.json `version`) this release understands. */
export const SUPPORTED_DATA_VERSIONS = ['v1.0']

export interface DataVersionIssue {
  file: string
  version: string | undefined
}

/** Data files whose version is unknown to this release (nswow changed the format → update @simple-reporting/core). */
export function checkDataVersions(files: Record<string, { version?: string } | undefined>): DataVersionIssue[] {
  return Object.entries(files)
    .filter(([, data]) => data && data.version !== undefined && !SUPPORTED_DATA_VERSIONS.includes(data.version))
    .map(([file, data]) => ({ file, version: data!.version }))
}
