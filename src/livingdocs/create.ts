import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stripPrefix } from './source'

/** Splits "group/name" (or "group\name"). */
export function parseComponentPath(value: string): { group?: string; name: string } {
  const parts = value.split(/[\\/]/).filter(Boolean)
  return parts.length > 1 ? { group: parts[0], name: parts.slice(1).join('-') } : { name: parts[0] ?? '' }
}

/** Creates a group folder (no-op when it exists). */
export async function createGroup(livingdocsDir: string, group: string): Promise<string> {
  const dir = join(livingdocsDir, group)
  await mkdir(dir, { recursive: true })
  return dir
}

/**
 * Scaffolds a component like SRL 1 `srl create component` (scss/editor.scss instead of ldd.scss).
 * Creates the group when needed (SRL 1 failed with EEXIST in that case).
 */
export async function createComponent(livingdocsDir: string, group: string, folder: string): Promise<string> {
  const dir = join(livingdocsDir, group, folder)
  if (existsSync(dir)) throw new Error(`Component ${group}/${folder} already exists.`)
  const name = stripPrefix(folder)
  const label = name.charAt(0).toUpperCase() + name.slice(1)

  await mkdir(join(dir, 'scss'), { recursive: true })
  const files: Record<string, string> = {
    [`${name}.html`]: `<p class="srl-grid srl-${name} srl-linkable"><span class="srl-grid__inner srl-${name}__text" doc-editable="paragraph">Editable Text</span></p>\n`,
    'ld-conf.json': `${JSON.stringify({ name, label }, null, 2)}\n`,
    'properties.json': '{}\n',
    'scss/general.scss': `@use "srl";\n\n.srl-${name} {\n}\n`,
    'scss/web.scss': '@use "srl";\n',
    'scss/app.scss': '@use "web";\n',
    'scss/editor.scss': '@use "web";\n',
    'scss/pdf.scss': '@use "srl";\n',
    'scss/word.scss': '@use "pdf";\n',
    'scss/xbrl.scss': '@use "srl";\n@use "general";\n',
  }
  await Promise.all(Object.entries(files).map(([file, content]) => writeFile(join(dir, file), content)))
  return dir
}
