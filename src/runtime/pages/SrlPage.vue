<script setup lang="ts">
import { computed, nextTick, onMounted } from 'vue'
import { createError, navigateTo, setResponseStatus, useHead, useRequestEvent, useRoute, useRuntimeConfig } from '#imports'
import { resolveSrlPath, useSrlArticle, useSrlManifest } from '../composables/srl'
import { SrlHtml } from '../../shared/html/render'

const route = useRoute()
const manifest = useSrlManifest()
const base = useRuntimeConfig().app.baseURL
const resolved = resolveSrlPath(manifest, route.path)

if (resolved.type === 'redirect') {
  await navigateTo({ path: resolved.to, hash: route.hash }, { redirectCode: 301 })
} else if (resolved.type === 'not-found') {
  // Unknown path: render the 404 page of the locale (article with slug "404" or ErrorView)
  // with status 404. Without one, fall back to the Nuxt error page.
  if (!resolved.entry) throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
  if (import.meta.server) {
    const event = useRequestEvent()
    if (event) setResponseStatus(event, 404, 'Page not found')
  }
}

const notFound = resolved.type === 'not-found'
const entry = resolved.type === 'page' || resolved.type === 'not-found' ? resolved.entry : undefined
const article = entry && entry.kind !== 'special' ? await useSrlArticle(entry) : undefined
const publicationName = entry ? manifest.settings.publicationName?.[entry.locale] : undefined

useHead({
  htmlAttrs: { lang: entry?.locale },
  meta: notFound ? [{ name: 'robots', content: 'noindex' }] : [],
  title: entry ? [entry.title, publicationName].filter(Boolean).join(' - ') : undefined,
  // inline <style> blocks of the article, removed again on navigation
  style: computed(() => (article?.value?.styles ?? []).map((css, index) => ({ key: `srl-article-${index}`, innerHTML: css }))),
  link: entry
    ? Object.entries(manifest.table.alternates[entry.uuid] ?? {}).map(([locale, path]) => ({
        rel: 'alternate',
        hreflang: locale,
        href: base + path.slice(1),
      }))
    : [],
})

// Scroll to the #anchor once the article is rendered (client navigation and initial load; accordions
// that contain the target open themselves on mount first).
onMounted(async () => {
  const id = decodeURIComponent(route.hash.slice(1))
  if (!id) return
  await nextTick()
  setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 0)
})
</script>

<template>
  <!-- srl-article-root: SRL 1 class of the article container, used by project CSS and scripts -->
  <article v-if="entry" class="srl-article" :class="{ 'srl-article-root': article }" :data-uuid="entry.uuid">
    <SrlHtml v-if="article" :nodes="article.nodes" />
    <component :is="`SrlPage${entry.component}`" v-else-if="entry.kind === 'special'" :entry="entry" />
  </article>
</template>
