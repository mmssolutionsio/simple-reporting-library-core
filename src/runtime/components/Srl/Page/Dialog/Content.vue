<script setup lang="ts">
/**
 * `SrlPageDialogContent` – layout inside SrlPageDialog (SRL 1 project file src/Dialog.vue).
 * Override with app/components/Srl/Page/Dialog/Content.vue (same props, emit `close`).
 */
import type { SrlNode } from '../../../../../shared/html/nodes'

const props = withDefaults(defineProps<{ header?: string; content?: string; nodes?: SrlNode[] }>(), {
  header: '',
  content: '',
  nodes: undefined,
})

const emit = defineEmits<{ (e: 'close'): void }>()
</script>

<template>
  <div class="srl-dialog srl-bg-light srl-color-dark" @click.stop>
    <header class="srl-dialog__header">
      <div v-if="props.header !== '' || $slots.header" class="srl-dialog__header--body">
        <h2 v-if="props.header !== ''" class="srl-dialog__title" v-html="props.header" />
        <slot name="header" />
      </div>
      <button
        type="button"
        class="srl-dialog__close srl-button srl-button--icon"
        :title="$t('modalClose')"
        :aria-label="$t('modalClose')"
        @click="emit('close')"
      >
        <i class="srl-icon-close" aria-hidden="true" />
      </button>
    </header>
    <main class="srl-dialog__main srl-article-root" tabindex="-1">
      <SrlHtml v-if="props.nodes" :nodes="props.nodes" />
      <div v-else-if="props.content !== ''" v-html="props.content" />
      <slot name="main" />
    </main>
    <footer v-if="$slots.footer" class="srl-dialog__footer">
      <slot name="footer" />
    </footer>
  </div>
</template>
