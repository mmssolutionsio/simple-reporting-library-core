import type { LivingdocsComponent, LivingdocsDesign } from './design'

type DesignLike = Partial<Pick<LivingdocsDesign, 'groups' | 'componentProperties'>> & { components?: Partial<LivingdocsComponent>[] }

const DIRECTIVE_IN_HTML = /doc-(container|editable|html|image|include|link|style|toggle|video)=[\\"']{1,}([a-zA-Z\-_\d]{1,}?)[\\"']{1,}/gm

/**
 * Checks a Livingdocs design. Port of SRL 1 scripts/ldd/LivingdocsDesignValidator.js; each check
 * returns true or throws. Use `validateDesign` to collect all problems at once.
 */
export class LivingdocsDesignValidator {
  constructor(private readonly design: DesignLike) {
    if (!design) throw new Error('no editor design given')
  }

  private get components() {
    return this.design.components ?? []
  }

  usedPropertiesAreDeclared(): true {
    const declared = this.design.componentProperties ?? {}
    const used = [...new Set(this.components.flatMap((c) => c.properties ?? []))]
    const missing = used.filter((name) => !declared[name])
    if (missing.length) throw new Error(`component properties [${missing}] are not declared`)
    return true
  }

  everyComponentHasAGroup(): true {
    const groups = this.design.groups ?? []
    const orphaned = this.components.filter((c) => !groups.some((g) => g.components.includes(c.name ?? '')))
    if (orphaned.length) {
      throw new Error(`components [${orphaned.map((c) => c.name)}] are not in any group and will not show in the editor`)
    }
    return true
  }

  hasNoDuplicateComponentNames(): true {
    const duplicates = findDuplicates(this.components.map((c) => c.name ?? ''))
    if (duplicates.length) throw new Error(`duplicate component names [${duplicates}]`)
    return true
  }

  hasNoDuplicateGroupLabels(): true {
    const duplicates = findDuplicates((this.design.groups ?? []).map((g) => g.label))
    if (duplicates.length) throw new Error(`duplicate group label [${duplicates}]`)
    return true
  }

  /** Warning only. */
  unusedComponentProperties(): string[] {
    return Object.keys(this.design.componentProperties ?? {}).filter(
      (name) => !this.components.some((c) => c.properties?.includes(name)),
    )
  }

  everyDeclaredDirectiveExistsOnComponent(): boolean {
    return this.components.map((c) => this.declaredDirectivesExistOnComponent(c)).every(Boolean)
  }

  declaredDirectivesExistOnComponent(component: Partial<LivingdocsComponent>): true {
    const { html = '', directives } = component
    const types: string[] = []
    const names: string[] = []
    const found: Record<string, boolean> = Object.fromEntries(Object.keys(directives ?? {}).map((d) => [d, false]))

    for (const match of html.matchAll(DIRECTIVE_IN_HTML)) {
      types.push(match[1]!)
      names.push(match[2]!)
      found[match[2]!] = true
    }

    const duplicateNames = findDuplicates(names)
    if (duplicateNames.length) {
      throw new Error(`duplicate directive values [${duplicateNames}] in component "${component.name}"`)
    }
    if (types.filter((type) => type === 'link').length > 1) {
      throw new Error(`directive doc-link used multiple times in component "${component.name}"`)
    }
    if (!directives) return true

    for (const [name, directive] of Object.entries(directives)) {
      if ((directive.allowedChildren?.length || directive.defaultContent?.length) && !this.containerTargetsExist(directive)) {
        throw new Error(`directive "${name}" in component "${component.name}" references non-existing component/s`)
      }
    }
    const notReferenced = Object.keys(directives).filter((name) => found[name] !== true)
    if (notReferenced.length) {
      throw new Error(`directives [${notReferenced}] in component "${component.name}" is declared but not referenced in html`)
    }
    return true
  }

  everyAllowedParentExistsInDesign(): true {
    const names = new Set(this.components.map((c) => c.name))
    const missing = this.components
      .filter((c) => Array.isArray(c.allowedParents))
      .flatMap((c) => c.allowedParents!.filter((parent) => parent !== 'root' && !names.has(parent)))
    if (missing.length) throw new Error(`allowed parents [${missing}] do not exist in design`)
    return true
  }

  private containerTargetsExist(directive: { allowedChildren?: string[]; defaultContent?: { component: string }[] }) {
    const names = new Set(this.components.map((c) => c.name))
    return (
      (directive.allowedChildren ?? []).every((name) => names.has(name)) &&
      (directive.defaultContent ?? []).every((content) => names.has(content.component))
    )
  }
}

export interface DesignValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/** Runs all checks and collects every error (SRL 1 stopped at the first one). */
export function validateDesign(design: DesignLike): DesignValidation {
  const validator = new LivingdocsDesignValidator(design)
  const errors: string[] = []
  const run = (check: () => unknown) => {
    try {
      check()
    } catch (error) {
      errors.push((error as Error).message)
    }
  }
  run(() => validator.hasNoDuplicateComponentNames())
  run(() => validator.hasNoDuplicateGroupLabels())
  run(() => validator.usedPropertiesAreDeclared())
  run(() => validator.everyAllowedParentExistsInDesign())
  run(() => validator.everyComponentHasAGroup())
  for (const component of design.components ?? []) run(() => validator.declaredDirectivesExistOnComponent(component))

  const unused = validator.unusedComponentProperties()
  const warnings = unused.length ? [`component properties [${unused}] are unused and can be removed`] : []
  return { valid: errors.length === 0, errors, warnings }
}

function findDuplicates(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index)
}
