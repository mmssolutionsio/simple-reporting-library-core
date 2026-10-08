import type { SrlConfig } from './types'

/**
 * Typed identity helper for `srl.config.ts`:
 *
 * ```ts
 * import { defineSrlConfig } from '@simple-reporting/core/config'
 * export default defineSrlConfig({ colors: { colors: [...] } })
 * ```
 */
export function defineSrlConfig(config: SrlConfig): SrlConfig {
  return config
}
