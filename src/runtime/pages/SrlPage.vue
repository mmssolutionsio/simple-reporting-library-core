<script setup lang="ts">
import { computed } from 'vue'
import { createError, navigateTo, useHead, useRoute, useRuntimeConfig } from '#imports'
import { resolveSrlPath, useSrlArticle, useSrlManifest } from '../composables/srl'
import { SrlHtml } from '../../shared/html/render'

const route = useRoute()
const manifest = useSrlManifest()
const base = useRuntimeConfig().app.baseURL
const resolved = resolveSrlPath(manifest, route.path)

if (resolved.type === 'redirect') {
  await navigateTo({ path: resolved.to, hash: route.hash }, { redirectCode: 301 })
} else if (resolved.type === 'not-found') {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

const entry = resolved.type === 'page' ? resolved.entry : undefined
const article = entry && entry.kind !== 'special' ? await useSrlArticle(entry) : undefined
const publicationName = entry ? manifest.settings.publicationName?.[entry.locale] : undefined

useHead({
  htmlAttrs: { lang: entry?.locale },
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
</script>

<template>
  <article v-if="entry" class="srl-article" :data-uuid="entry.uuid">
    <SrlHtml v-if="article" :nodes="article.nodes" />
    <component :is="`SrlPage${entry.component}`" v-else-if="entry.kind === 'special'" :entry="entry" />
  </article>
</template>
