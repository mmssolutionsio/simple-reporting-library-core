<script setup lang="ts">
import { computed } from 'vue'
import type { SrlNavigationItem } from '../../../../../utils/menu'

const props = withDefaults(
  defineProps<{ item: SrlNavigationItem; depth: number; disableClasses: boolean; position?: '' | 'Before' | 'After' }>(),
  { position: '' },
)

const classList = computed(() => {
  const prefix = props.item.iconPrefix ?? 'srl-icon'
  const icon = props.item[`icon${props.position}`]
  const result = [prefix, `${prefix}-${icon}`]
  if (!props.disableClasses) result.push('srl-menu__link-icon', `srl-menu__link-icon--level-${props.depth}`)
  return result
})
</script>

<template>
  <i :class="classList" aria-hidden="true" />
</template>
