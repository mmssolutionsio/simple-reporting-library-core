// Ported from SRL 1 srl/.srl/utils/object.ts (pure).
type PlainObject = Record<string, unknown>

export function isPlainObject(value: unknown): value is PlainObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Deep-merges `source` into `target` (mutates and returns target). Objects are merged
 * recursively, arrays index by index, everything else is overwritten by source.
 */
export function objectDeepAssign<T extends PlainObject>(target: T, source: PlainObject | undefined): T {
  if (Array.isArray(target) || Array.isArray(source)) {
    throw new TypeError('objectDeepAssign expects objects as root parameters')
  }
  for (const key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue
    ;(target as PlainObject)[key] = mergeNode((target as PlainObject)[key], source[key])
  }
  return target
}

function mergeNode(targetValue: unknown, sourceValue: unknown): unknown {
  if (Array.isArray(sourceValue)) {
    const targetArray: unknown[] = Array.isArray(targetValue) ? targetValue : []
    const length = Math.max(targetArray.length, sourceValue.length)
    return Array.from({ length }, (_, i) => (i < sourceValue.length ? mergeNode(targetArray[i], sourceValue[i]) : targetArray[i]))
  }
  if (isPlainObject(sourceValue)) {
    return objectDeepAssign(isPlainObject(targetValue) ? targetValue : {}, sourceValue)
  }
  return sourceValue
}

/** Deep merge without mutating the inputs. */
export function deepMerge<T extends PlainObject>(...sources: (PlainObject | undefined)[]): T {
  const result = {} as T
  for (const source of sources) objectDeepAssign(result, structuredClone(source ?? {}))
  return result
}

/** SRL 1 utils/string.ts */
export function camelCase(value: string): string {
  return value.replace(/[._-](\w|$)/g, (_, x: string) => x.toUpperCase())
}
