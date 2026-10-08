import type { SrlConfig } from '../config/types'

/**
 * Source of the module behind `useSrlDesignConfig()` (replaces SRL 1
 * `generateUseSrlConfig`, which wrote `.srl/composables/srlConfig.ts`).
 *
 * The module exports the design tokens of the project config as a Vue `ref`,
 * like SRL 1. The `project` key is not part of the design and is left out.
 */
export function renderUseSrlDesignConfig(config: SrlConfig): string {
  const { project: _project, ...design } = config
  return [
    `import { ref } from 'vue'`,
    `const srlDesignConfig = ref(${JSON.stringify(design, null, 2)})`,
    `export function useSrlDesignConfig() {`,
    `  return srlDesignConfig`,
    `}`,
    `export default useSrlDesignConfig`,
    ``,
  ].join('\n')
}

/** Type declaration matching {@link renderUseSrlDesignConfig}. */
export function renderUseSrlDesignConfigTypes(
  configTypeImport = '@simple-reporting/core/config',
): string {
  return [
    `import type { Ref } from 'vue'`,
    `import type { SrlConfigSections } from '${configTypeImport}'`,
    `export declare function useSrlDesignConfig(): Ref<SrlConfigSections>`,
    `export default useSrlDesignConfig`,
    ``,
  ].join('\n')
}
