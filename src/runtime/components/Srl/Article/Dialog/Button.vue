<script setup lang="ts">
/**
 * `SrlArticleDialogButton` – opens a dialog article (notes-<x>-<nr>); created by the HTML
 * pipeline from popup links (`<srl-article-dialog-button uuid anchor>`).
 *
 * All buttons for the same uuid share one dialog (useSrlDialog registry): the first mounted
 * button renders it (teleported to body, browser only). The article JSON is loaded on mount in
 * the browser; its inline styles are added with useHead while the dialog is rendered.
 */
import { useHead } from '#imports'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue'
import { useSrlDialog } from '../../../../composables/dialog'
import { fetchSrlArticle, useSrlLocale, type SrlArticleData } from '../../../../composables/srl'

const props = defineProps<{
  uuid: string
  anchor?: string
  /** Locale of the dialog article, default: locale of the current page. */
  locale?: string
}>()

const currentLocale = useSrlLocale()
const locale = computed(() => props.locale ?? currentLocale.value)
const key = computed(() => `${locale.value}/${props.uuid}`)
const dialogId = computed(() => `srl-page__dialog-${props.uuid.replaceAll(' ', '_')}`)
const buttonId = useId()

const dialog = useSrlDialog(key)
const mounted = ref(false)
const isOwner = computed(() => mounted.value && dialog.owner.value === buttonId)
const article = shallowRef<SrlArticleData>()

async function load() {
  if (article.value?.uuid === props.uuid && article.value.locale === locale.value) return
  try {
    article.value = await fetchSrlArticle(locale.value, props.uuid)
  } catch (error) {
    console.error(`[srl] Dialog article ${key.value} could not be loaded.`, error)
  }
}

onMounted(() => {
  mounted.value = true
  // claim again whenever the dialog has no renderer (owner unmounted, navigation reset)
  watch(
    () => [key.value, dialog.owner.value] as const,
    () => {
      if (!dialog.owner.value) dialog.claim(buttonId)
    },
    { immediate: true },
  )
  watch(isOwner, (owner) => owner && load(), { immediate: true })
})

onBeforeUnmount(() => dialog.release(buttonId))

useHead({
  style: computed(() =>
    isOwner.value && article.value
      ? article.value.styles.map((css, index) => ({ key: `srl-dialog-${key.value}-${index}`, innerHTML: css }))
      : [],
  ),
})

const open = computed({
  get: () => dialog.isOpen.value,
  set: (value) => (value ? dialog.open(props.anchor) : dialog.close()),
})

function onClick() {
  dialog.open(props.anchor)
}

// scroll to the anchor inside the dialog after opening
watch(
  () => isOwner.value && dialog.isOpen.value && !!article.value,
  async (ready) => {
    const anchor = dialog.anchor.value
    if (!ready || !anchor) return
    await nextTick()
    document.getElementById(dialogId.value)?.querySelector(`[id="${CSS.escape(anchor)}"]`)?.scrollIntoView({ block: 'start' })
  },
)
</script>

<template>
  <button
    class="srl-dialog-button"
    type="button"
    :aria-controls="dialogId"
    aria-haspopup="dialog"
    :aria-expanded="dialog.isOpen.value"
    @click="onClick"
  >
    <slot />
    <Teleport v-if="isOwner && article" to="body">
      <SrlPageDialog :id="dialogId" v-model:open="open" :nodes="article.nodes" />
    </Teleport>
  </button>
</template>
