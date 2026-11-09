<script setup lang="ts">
/**
 * Dev only: /<locale>/dev (SRL 1 DevView). Placeholder until the project has
 * app/views/DevView.vue; restart `srl dev` after creating it.
 */
import { useHead } from '#imports'
import { useSrlLocale } from '../composables/srl'

const locale = useSrlLocale()
useHead({ htmlAttrs: { lang: locale }, title: 'Dev', meta: [{ name: 'robots', content: 'noindex' }] })
</script>

<template>
  <article class="srl-article srl-article-root">
    <h1>Test your components here</h1>
    <p>
      Create <code>app/views/DevView.vue</code> and restart <code>srl dev</code>. This page only exists in
      the dev server.
    </p>
  </article>
</template>
