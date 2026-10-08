import { defineNuxtPlugin, navigateTo, useRuntimeConfig } from '#imports'
import htmlComponents from '#build/srl/html-components.mjs'
import type { Component } from 'vue'
import { SRL_HTML_RESOLVER } from '../../shared/html/render'
import { isFilePath } from '../../shared/uri'

export default defineNuxtPlugin((nuxtApp) => {
  const components = htmlComponents as Record<string, Component>
  const warned = new Set<string>()

  nuxtApp.vueApp.provide(SRL_HTML_RESOLVER, (tag: string) => {
    const component = components[tag]
    if (!component && import.meta.dev && !warned.has(tag)) {
      warned.add(tag)
      console.warn(`[srl] No component registered for <${tag}>.`)
    }
    return component
  })

  if (import.meta.server) return

  // Article HTML contains plain <a href> (crawlable). Internal links navigate client-side.
  const base = useRuntimeConfig().app.baseURL
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return
    const url = new URL(link.href, window.location.href)
    if (url.origin !== window.location.origin || !url.pathname.startsWith(base) || isFilePath(url.pathname)) return
    if (url.pathname === window.location.pathname && url.hash) return
    event.preventDefault()
    navigateTo(`/${url.pathname.slice(base.length)}${url.search}${url.hash}`)
  })
})
