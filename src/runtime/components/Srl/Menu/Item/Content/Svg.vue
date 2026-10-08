<script setup lang="ts">
import { computed } from 'vue'
import type { SrlNavigationItem } from '../../../../../utils/menu'

const props = withDefaults(
  defineProps<{ item: SrlNavigationItem; depth: number; disableClasses: boolean; position?: '' | 'Before' | 'After' }>(),
  { position: '' },
)

const svg = computed(() => props.item[`svg${props.position}`])
const classList = computed(() =>
  props.disableClasses ? [] : ['srl-menu__link-svg', `srl-menu__link-svg--level-${props.depth}`],
)
</script>

<template>
  <SrlSvg :svg="svg" :class="classList" :aria-hidden="position ? 'true' : undefined" />
</template>
