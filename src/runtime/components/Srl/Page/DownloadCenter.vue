<script setup lang="ts">
/** `SrlPageDownloadCenter` – default download center (special page "DownloadCenter"), overridable. */
import type { RouteEntry } from '../../../../shared/routes/buildRouteTable'
import { useSrlDownloadGroups } from '../../../composables/navigation'
import { useSrlLocale } from '../../../composables/srl'

defineProps<{ entry?: RouteEntry }>()

const groups = useSrlDownloadGroups()
const locale = useSrlLocale()
</script>

<template>
  <div class="srl-download-center">
    <h1 v-if="entry" class="srl-download-center__title">{{ entry.title }}</h1>
    <section v-for="(group, index) in groups" :key="index" class="srl-download-center__section">
      <h2 v-if="group.title" class="srl-download-center__section-title">{{ group.title }}</h2>
      <ul class="srl-download-center__list">
        <li v-for="(file, fileIndex) in group.items" :key="fileIndex" class="srl-download-center__item">
          <a class="srl-download-center__link" :href="file.href" download>
            <strong>{{ file.title }}</strong>
            <span class="srl-download-center__meta">
              {{ [file.fileType, file.size, locale.toUpperCase()].filter(Boolean).join(' | ') }}
            </span>
          </a>
        </li>
      </ul>
    </section>
  </div>
</template>
