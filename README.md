# @simple-reporting/core

Simple Reporting Library 2: Nuxt module, `srl` CLI and the non-Nuxt build targets
(Livingdocs editor design, PDF/PDFreactor, Word, XBRL).

> Alpha. Create a project with `npm create @simple-reporting@alpha <folder>`.

```ts
// nuxt.config.ts
export default defineNuxtConfig({ modules: ['@simple-reporting/core'] })
```

| Command | Purpose |
|---|---|
| `srl dev [--preview]` | Dev server |
| `srl build [version] [-t app,editor,pdf,word,xbrl]` | Preview app for nswow (`dist/app.zip`), design (`dist/design.zip`), pdf, word, xbrl |
| `srl build -t generate --base /path/` | Static site from `data/` (run by nswow) |
| `srl data import <zip\|folder>` | Data of a downloaded nswow preview into `data/` |
| `srl add\|remove components\|groups`, `srl create component\|group` | Livingdocs components |
| `srl update [--check]`, `srl doctor` | Updates, checks |

## Rewriting article HTML

The Nitro runtime hook `srl:article:html` runs before an article is turned into the render
tree (prerender and dev server, not in preview mode). Change `ctx.html` in place:

```ts
// server/plugins/articleHtml.ts
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('srl:article:html', (ctx) => {
    ctx.html = ctx.html.replaceAll('&nbsp;', ' ')
  })
})
```

## Code completion for `@use 'srl'`

`srl dev` and `srl build` write the generated SCSS module to `srl/` in the project
(gitignored, do not edit). It is a real folder, so IDEs resolve `@use 'srl'`,
`@use 'srl/typography'` and `@use 'srl/fa'` without the Vite alias:

- **PhpStorm/WebStorm:** works without setup (the project root is searched).
- **VS Code:** install [Some Sass](https://marketplace.visualstudio.com/items?itemName=SomewhatStationery.some-sass)
  and set `"somesass.workspace.loadPaths": ["."]` (new projects get this in `.vscode/`).

Only `srl/config.scss` differs per target (`$build`, `$size-unit`); each target build rewrites
it and restores the app values afterwards.
