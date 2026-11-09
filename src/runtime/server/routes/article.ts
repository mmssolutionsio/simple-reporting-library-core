import { createError, defineEventHandler, getRouterParam } from 'h3'
import { useNitroApp, useRuntimeConfig } from 'nitropack/runtime'
import { prepareArticleHtml } from '../../../shared/html/prepare'
import { articleHtmlPath } from '../../../shared/manifest'
import { getManifest, readDataFile } from '../utils/srlData'

/** /_srl/article/<locale>/<uuid>.json → prepared article (render tree, styles, dialogs). */
export default defineEventHandler(async (event) => {
  const locale = getRouterParam(event, 'locale') ?? ''
  const uuid = decodeURIComponent(getRouterParam(event, 'file') ?? '').replace(/\.json$/, '')
  const { table } = await getManifest()
  const localeTable = table.locale[locale]
  const article = localeTable?.byUuid[uuid] ?? localeTable?.dialogs[uuid]
  if (!article) {
    throw createError({ statusCode: 404, statusMessage: `Unknown article ${locale}/${uuid}` })
  }
  // Projects can rewrite the raw nswow HTML before it is prepared (server plugin, hook 'srl:article:html').
  const ctx = { html: String(await readDataFile(articleHtmlPath(locale, article.name))), uuid, locale }
  await useNitroApp().hooks.callHook('srl:article:html', ctx)
  const prepared = prepareArticleHtml(ctx.html, { table, locale, base: useRuntimeConfig().app.baseURL })
  return { uuid, locale, title: article.title, ...prepared }
})
