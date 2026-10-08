<script setup lang="ts">
import { computed } from 'vue'
import type { SrlNavigationItem } from '../../../../../utils/menu'

const props = withDefaults(
  defineProps<{ item: SrlNavigationItem; depth: number; disableClasses: boolean; position?: '' | 'Before' | 'After' }>(),
  { position: '' },
)

const image = computed(() => props.item[`img${props.position}`])
const classList = computed(() =>
  props.disableClasses ? [] : ['srl-menu__link-image', `srl-menu__link-image--level-${props.depth}`],
)
</script>

<template>
  <img
    :class="classList"
    :src="image?.src"
    :alt="image?.alt ?? (position ? '' : item.label)"
    :aria-hidden="position ? 'true' : undefined"
  />
</template>
