<script setup lang="ts">
/** `SrlPageErrorView` – default 404 page (special page "ErrorView"), overridable. */
import type { RouteEntry } from '../../../../shared/routes/buildRouteTable'
import { useSrlLocale, useSrlManifest } from '../../../composables/srl'

defineProps<{ entry?: RouteEntry }>()

const manifest = useSrlManifest()
const locale = useSrlLocale(manifest)
</script>

<template>
  <div class="srl-error-view">
    <h1>{{ entry?.title ?? '404' }}</h1>
    <p>
      <NuxtLink :to="manifest.table.locale[locale]?.index?.path ?? `/${locale}`">{{ $t('search.backToHomepage') }}</NuxtLink>
    </p>
  </div>
</template>
