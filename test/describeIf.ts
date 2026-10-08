import { describe, it } from 'vitest'

/**
 * Like describe.skipIf, but does not run the suite body when the condition is false
 * (vitest still collects skipped suites, and these bodies read local fixtures that only
 * exist in the monorepo: fixtures/data, the SRL 1 test project).
 */
export function describeIf(condition: boolean) {
  return condition
    ? describe
    : (name: string, _body: () => void) => describe.skip(name, () => it('requires local fixtures', () => {}))
}
