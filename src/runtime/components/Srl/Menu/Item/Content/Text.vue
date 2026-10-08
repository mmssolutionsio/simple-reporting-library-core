<script setup lang="ts">
import { computed } from 'vue'
import type { SrlNavigationItem } from '../../../../../utils/menu'

const props = defineProps<{ item: SrlNavigationItem; depth: number; disableClasses: boolean }>()

const classList = computed(() =>
  props.disableClasses ? [] : ['srl-menu__link-text', `srl-menu__link-text--level-${props.depth}`],
)
</script>

<template>
  <span :class="classList" v-text="item.label" />
</template>
