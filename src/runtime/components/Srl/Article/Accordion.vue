<script setup lang="ts">
/**
 * `SrlArticleAccordion` – progressive accordion around nswow markup (toggle, wrapper, content
 * found by selector). Opens itself when the URL hash points to it or into it; the first such
 * accordion scrolls into view. DOM work happens on mount only (SSR safe).
 */
import { useRoute } from '#imports'
import { computed, onMounted, ref, useId } from 'vue'
import { useSrlAccordionAnchored } from '../../../composables/pageState'

const props = withDefaults(
  defineProps<{
    toggleSelector?: string
    contentSelector?: string
    wrapperSelector?: string
    openClass?: string
    duration?: number | string
  }>(),
  {
    toggleSelector: '.srl-article-accordion__toggle',
    contentSelector: '.srl-article-accordion__content',
    wrapperSelector: '.srl-article-accordion__wrapper',
    openClass: 'open',
    duration: 300,
  },
)

const route = useRoute()
const anchored = useSrlAccordionAnchored()
const id = useId()
const root = ref<HTMLDivElement | null>(null)
const duration = computed(() => Number(props.duration) || 0)
const transition = computed(() => `${duration.value}ms`)

let toggle: HTMLElement | null = null
let content: HTMLElement | null = null
let wrapper: HTMLElement | null = null

function open() {
  if (!toggle || !content || !wrapper) return
  toggle.setAttribute('aria-expanded', 'true')
  wrapper.removeAttribute('hidden')
  content.classList.add(props.openClass)
  content.focus({ preventScroll: true })
}

function close() {
  if (!toggle || !content || !wrapper) return
  const w = wrapper
  toggle.setAttribute('aria-expanded', 'false')
  content.classList.remove(props.openClass)
  setTimeout(() => w.setAttribute('hidden', 'true'), duration.value)
}

function findHashTarget(r: HTMLElement, hash: string): boolean {
  const target = decodeURIComponent(hash.slice(1))
  if (!target) return false
  if (r.id === target) return true
  return !!r.querySelector(`[id="${CSS.escape(target)}"]`)
}

onMounted(() => {
  const r = root.value
  if (!r) return
  toggle = r.querySelector<HTMLElement>(props.toggleSelector)
  content = r.querySelector<HTMLElement>(props.contentSelector)
  wrapper = r.querySelector<HTMLElement>(props.wrapperSelector)
  if (!toggle || !content || !wrapper) return

  wrapper.setAttribute('hidden', 'true')
  content.id ||= id
  content.setAttribute('tabindex', '-1')
  toggle.setAttribute('aria-controls', content.id)
  toggle.setAttribute('aria-expanded', 'false')
  toggle.addEventListener('click', () => (toggle?.getAttribute('aria-expanded') === 'true' ? close() : open()))

  if (route.hash && findHashTarget(r, route.hash)) {
    open()
    if (!anchored.value) {
      anchored.value = true
      setTimeout(() => r.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200)
    }
  }
})
</script>

<template>
  <div ref="root" class="srl-article-accordion" tabindex="-1">
    <slot />
  </div>
</template>

<style>
.srl-article-accordion__content {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows v-bind(transition) ease-out;
}
.srl-article-accordion__content.open {
  grid-template-rows: 1fr;
}
.srl-article-accordion__wrapper {
  overflow: hidden;
}
</style>
