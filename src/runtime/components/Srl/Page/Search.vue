<script setup lang="ts">
/**
 * `SrlPageSearch` – default search page (special page component "Search"). Minimal and
 * overridable: app/components/Srl/Page/Search.vue. Query in `?s=`.
 */
import { navigateTo, useRoute } from '#imports'
import { computed, ref, watch } from 'vue'
import type { RouteEntry } from '../../../../shared/routes/buildRouteTable'
import { useSrlSearch } from '../../../composables/search'

defineProps<{ entry?: RouteEntry }>()

const route = useRoute()
const { search, pending, index } = useSrlSearch()
const query = ref(typeof route.query.s === 'string' ? route.query.s : '')
const submitted = ref(query.value)
watch(
  () => route.query.s,
  (value) => (query.value = submitted.value = typeof value === 'string' ? value : ''),
)

const results = computed(() => (index.value ? search(submitted.value) : []))

function submit() {
  submitted.value = query.value
  navigateTo({ path: route.path, query: query.value ? { s: query.value } : {} }, { replace: true })
}
</script>

<template>
  <div class="srl-search__wrap">
    <form class="srl-search-form" role="search" @submit.prevent="submit">
      <label for="srl-search-input" class="srl-search-form__label">{{ $t('accessibility.searchLabel') }}</label>
      <input
        id="srl-search-input"
        v-model="query"
        type="search"
        class="srl-search-form__input"
        :placeholder="$t('search.placeholder')"
      />
      <button type="submit" class="srl-search-form__button srl-button" :aria-label="$t('search.search')">
        <i class="srl-icon-search" aria-hidden="true" />
      </button>
    </form>
    <p v-if="pending" class="srl-search-results__pending" aria-live="polite">…</p>
    <div v-else-if="results.length" class="srl-search-results">
      <h2 class="srl-search-results__main-title">
        {{ $t('search.resultCount', { count: results.length, text: submitted }, results.length) }}
      </h2>
      <ul class="srl-search-results__list">
        <li v-for="result in results" :key="result.entry.uuid" class="srl-search-results__item">
          <NuxtLink :to="result.entry.path" class="srl-search-results__link">
            <h3 class="srl-search-results__title">{{ result.entry.title }}</h3>
            <p v-if="result.html" class="srl-search-results__snippet" v-html="result.html" />
          </NuxtLink>
        </li>
      </ul>
    </div>
    <p v-else-if="submitted && index" class="srl-search-results__empty">{{ $t('search.noResultsMessage') }}</p>
  </div>
</template>
