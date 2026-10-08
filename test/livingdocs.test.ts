import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { describeIf } from './describeIf'
import {
  applyPlan,
  buildEditorDesign,
  createComponent,
  formatGroupLabel,
  livingdocsVueComponents,
  loadSource,
  planInstall,
  removeComponents,
  validateDesign,
  type LivingdocsSource,
} from '../src/livingdocs'

function tree(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'srl-ld-'))
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), content)
  }
  return dir
}

const component = (name: string) => ({
  [`${name}/${name.split('/').pop()!.replace(/^\d+\./, '')}.html`]: '<p doc-editable="text">x</p>',
  [`${name}/ld-conf.json`]: JSON.stringify({ name: name.split('/').pop()!.replace(/^\d+\./, '') }),
})

describe('planInstall', () => {
  const standard: LivingdocsSource = {
    name: '@simple-reporting/livingdocs',
    dir: tree({
      ...component('010.Titles/010.title-h1'),
      ...component('010.Titles/020.title-h2'),
      ...component('040.Media/010.table'),
      '999.Properties/alignment/properties.json': '{}',
      '050.Hero/.gitkeep': '',
      '999.Properties/README.md': 'loose file',
    }),
    defaults: ['010.Titles/010.title-h1', '040.Media/010.table', '999.Properties/alignment'],
  }
  const alternative: LivingdocsSource = {
    name: '@acme/livingdocs',
    dir: tree({ ...component('015.Acme/005.table'), ...component('015.Acme/010.teaser') }),
    defaults: ['015.Acme/010.teaser'],
  }

  it('installs the defaults of both packages, the alternative overrides same-named components', () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'srl-project-'))
    const plan = planInstall({ standard, alternative, projectDir, mode: 'defaults' })
    expect(plan.install.map((i) => [i.key, i.from.source, i.to])).toEqual([
      ['component:title-h1', '@simple-reporting/livingdocs', '010.Titles/010.title-h1'],
      ['component:table', '@acme/livingdocs', '015.Acme/005.table'],
      ['property:alignment', '@simple-reporting/livingdocs', '999.Properties/alignment'],
      ['component:teaser', '@acme/livingdocs', '015.Acme/010.teaser'],
    ])
    expect(plan.skipped).toEqual([])
  })

  it('never offers or touches components that exist in the project (prefix and group ignored)', () => {
    const projectDir = tree({ ...component('100.Ueberschriften/999.title-h1'), ...component('010.Titles/020.title-h2') })
    const plan = planInstall({ standard, alternative, projectDir, mode: 'select', keys: ['component:title-h1', 'component:teaser', 'component:nope'] })
    expect(plan.offered.map((e) => e.key).sort()).toEqual(['component:table', 'component:teaser', 'property:alignment'])
    expect(plan.install.map((i) => i.key)).toEqual(['component:teaser'])
    expect(plan.skipped).toEqual([
      { key: 'component:title-h1', reason: 'installed' },
      { key: 'component:nope', reason: 'unknown' },
    ])
  })

  it('puts components into an existing project group with the same name', () => {
    const projectDir = tree(component('200.Titles/010.title-h2'))
    const plan = planInstall({ standard, projectDir, mode: 'select', keys: ['component:title-h1'] })
    expect(plan.install[0]!.to).toBe('200.Titles/010.title-h1')
  })

  it('offers folders only, no loose files', () => {
    const plan = planInstall({ standard, projectDir: mkdtempSync(join(tmpdir(), 'p-')), mode: 'select' })
    expect(plan.offered.every((e) => existsSync(join(e.dir, '..')))).toBe(true)
    expect(plan.offered.map((e) => e.folder)).not.toContain('README.md')
  })

  it('applies a plan without overwriting and removes components completely', async () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'srl-project-'))
    const plan = planInstall({ standard, alternative, projectDir, mode: 'defaults' })
    expect(await applyPlan(plan, projectDir, { dryRun: true })).toHaveLength(4)
    expect(readdirSync(projectDir)).toEqual([])

    expect(await applyPlan(plan, projectDir)).toHaveLength(4)
    expect(readFileSync(join(projectDir, '015.Acme/005.table/ld-conf.json'), 'utf8')).toContain('"table"')
    writeFileSync(join(projectDir, '010.Titles/010.title-h1/title-h1.html'), 'changed')
    expect(await applyPlan(plan, projectDir)).toEqual([])
    expect(readFileSync(join(projectDir, '010.Titles/010.title-h1/title-h1.html'), 'utf8')).toBe('changed')

    expect(await removeComponents(projectDir, ['component:table'])).toEqual(['015.Acme/005.table'])
    expect(existsSync(join(projectDir, '015.Acme/005.table'))).toBe(false)
  })
})

describe('createComponent', () => {
  it('creates a component in a new group', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'srl-ld-'))
    await createComponent(dir, '200.New_Group', '010.teaser')
    expect(readdirSync(join(dir, '200.New_Group/010.teaser')).sort()).toEqual(['ld-conf.json', 'properties.json', 'scss', 'teaser.html'])
    expect(readdirSync(join(dir, '200.New_Group/010.teaser/scss')).sort()).toEqual(
      ['app.scss', 'editor.scss', 'general.scss', 'pdf.scss', 'web.scss', 'word.scss', 'xbrl.scss'],
    )
    await expect(createComponent(dir, '200.New_Group', '010.teaser')).rejects.toThrow('already exists')
  })
})

describe('formatGroupLabel', () => {
  it.each([
    ['010.Titles', 'Titles'],
    ['130.Hosting_Components', 'Hosting Components'],
    ['050.Hero_and_Slider', 'Hero / Slider'],
    ['999.Properties', 'Properties'],
  ])('%s -> %s', (group, label) => expect(formatGroupLabel(group)).toBe(label))
})

const testProject = resolve(__dirname, '../../../../simple-reporting-library-test-project')
const packageDir = resolve(__dirname, '../../livingdocs')

describeIf(existsSync(packageDir))('livingdocs package (monorepo only)', () => {
  it('has a valid manifest whose defaults all exist', () => {
    const source = loadSource(packageDir, '@simple-reporting/livingdocs')
    expect(source.defaults.length).toBeGreaterThan(40)
    for (const path of source.defaults) expect(existsSync(join(source.dir, path)), path).toBe(true)
  })

  it('maps Vue files to srl-ld-* tags like SRL 1', () => {
    const tags = livingdocsVueComponents(join(packageDir, 'components')).map((c) => [c.name, c.tag])
    expect(tags).toContainEqual(['SrlLdTable', 'srl-ld-table'])
    expect(tags).toContainEqual(['SrlLdDownloadCenter', 'srl-ld-download-center'])
    expect(tags).toContainEqual(['SrlLdSearchHighlightOnTarget', 'srl-ld-search-highlight-on-target'])
  })
})

describeIf(existsSync(join(testProject, 'livingdocs.config.json')))('buildEditorDesign parity with SRL 1', () => {
  it('produces the same groups, components and properties as SRL 1 mapLdd', async () => {
    const srl1 = JSON.parse(readFileSync(join(testProject, 'livingdocs.config.json'), 'utf8'))
    const { name, version, assets, groups, components, componentProperties, ...manual } = srl1
    const { design, warnings } = await buildEditorDesign({
      livingdocsDir: join(testProject, 'livingdocs'),
      baseConfig: manual,
      name: 'test',
      version: '1.0.0',
      assets: { css: ['assets/editor.css'] },
    })
    expect(warnings).toEqual([])
    expect(design.groups).toEqual(groups)
    expect(design.components).toEqual(components)
    expect(design.componentProperties).toEqual(componentProperties)
    expect(Object.keys(design)).toEqual(expect.arrayContaining(Object.keys(manual)))
    expect(design.assets).toMatchObject({ css: ['assets/editor.css'], js: [] })
    expect(validateDesign(design).errors).toEqual([])
  })

  it('warns about generated keys in livingdocs.config.json and ignores them', async () => {
    const { design, warnings } = await buildEditorDesign({
      livingdocsDir: join(testProject, 'livingdocs'),
      baseConfig: { label: 'X', groups: [], components: [{ name: 'old' }] },
      name: 'n',
      version: '2.0.0',
    })
    expect(warnings).toHaveLength(2)
    expect(design.components.some((c) => c.name === 'old')).toBe(false)
  })
})

describe('validateDesign', () => {
  it('collects all errors instead of stopping at the first one', () => {
    const result = validateDesign({
      groups: [{ label: 'a', components: ['x'] }, { label: 'a', components: [] }],
      components: [
        { name: 'x', html: '<p></p>', properties: ['missing'] },
        { name: 'x', html: '<p></p>', allowedParents: ['ghost'] },
      ],
      componentProperties: { unused: {} },
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(4)
    expect(result.warnings).toEqual(['component properties [unused] are unused and can be removed'])
  })
})
