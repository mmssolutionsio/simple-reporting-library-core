/**
 * Registry of custom tags in the nswow HTML (e.g. `srl-ld-table`) and the components that
 * render them. Core components and the livingdocs mapping register here; the module turns the
 * list into the `#build/srl/html-components.mjs` template (tag -> lazy component).
 */
export interface SrlHtmlComponent {
  /** Tag in the HTML, lowercase with dash: `srl-ld-table`. */
  tag: string
  /** Absolute path of the .vue (or module) file. */
  filePath: string
  /** Named export, default export if omitted. */
  export?: string
  /** Higher priority wins when two registrations use the same tag (project > livingdocs > core). */
  priority?: number
}

export function renderHtmlComponentsTemplate(components: SrlHtmlComponent[]): string {
  const byTag = new Map<string, SrlHtmlComponent>()
  for (const component of components) {
    const existing = byTag.get(component.tag)
    if (!existing || (component.priority ?? 0) >= (existing.priority ?? 0)) byTag.set(component.tag, component)
  }
  const entries = [...byTag.values()]
    .sort((a, b) => a.tag.localeCompare(b.tag))
    .map(({ tag, filePath, export: name }) => {
      const load = `import(${JSON.stringify(filePath)})${name ? `.then((m) => m[${JSON.stringify(name)}])` : ''}`
      return `  ${JSON.stringify(tag)}: defineAsyncComponent(() => ${load}),`
    })
  return `import { defineAsyncComponent } from 'vue'\n\nexport default {\n${entries.join('\n')}\n}\n`
}
