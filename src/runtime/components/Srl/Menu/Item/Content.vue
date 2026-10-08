<script setup lang="ts">
/** `SrlMenuItemContent` – icon, image or svg (alone, before or after the label) or just the label. */
import { computed } from 'vue'
import type { SrlNavigationItem } from '../../../../utils/menu'

const props = defineProps<{
  item: SrlNavigationItem
  depth: number
  disableClasses: boolean
}>()

/** Graphic that replaces the label (icon, img, svg). */
const only = computed(() => (props.item.icon ? 'icon' : props.item.img ? 'img' : props.item.svg ? 'svg' : undefined))
const before = computed(() =>
  props.item.iconBefore ? 'icon' : props.item.imgBefore ? 'img' : props.item.svgBefore ? 'svg' : undefined,
)
const after = computed(() =>
  props.item.iconAfter ? 'icon' : props.item.imgAfter ? 'img' : props.item.svgAfter ? 'svg' : undefined,
)
</script>

<template>
  <SrlMenuItemContentIcon v-if="only === 'icon'" :item="item" :depth="depth" :disable-classes="disableClasses" />
  <SrlMenuItemContentImage v-else-if="only === 'img'" :item="item" :depth="depth" :disable-classes="disableClasses" />
  <SrlMenuItemContentSvg v-else-if="only === 'svg'" :item="item" :depth="depth" :disable-classes="disableClasses" />
  <template v-else>
    <SrlMenuItemContentIcon v-if="before === 'icon'" :item="item" :depth="depth" :disable-classes="disableClasses" position="Before" />
    <SrlMenuItemContentImage v-else-if="before === 'img'" :item="item" :depth="depth" :disable-classes="disableClasses" position="Before" />
    <SrlMenuItemContentSvg v-else-if="before === 'svg'" :item="item" :depth="depth" :disable-classes="disableClasses" position="Before" />
    <SrlMenuItemContentText :item="item" :depth="depth" :disable-classes="disableClasses" />
    <SrlMenuItemContentIcon v-if="after === 'icon'" :item="item" :depth="depth" :disable-classes="disableClasses" position="After" />
    <SrlMenuItemContentImage v-else-if="after === 'img'" :item="item" :depth="depth" :disable-classes="disableClasses" position="After" />
    <SrlMenuItemContentSvg v-else-if="after === 'svg'" :item="item" :depth="depth" :disable-classes="disableClasses" position="After" />
  </template>
</template>
