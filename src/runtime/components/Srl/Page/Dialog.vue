<script setup lang="ts">
/**
 * `SrlPageDialog` – modal <dialog> with tab chain (ported from SRL 1). The layout inside is
 * `SrlPageDialogContent` (override it in the project, SRL 1: src/Dialog.vue).
 *
 * Content: `nodes` (prepared article nodes, rendered with SrlHtml), `content` (HTML string) or
 * the slots header/main (or default)/footer. Open state: v-model:open or the exposed open()/close().
 */
import { nextTick, onMounted, ref, watch } from 'vue'
import type { SrlNode } from '../../../../shared/html/nodes'

const props = withDefaults(
  defineProps<{
    id?: string
    header?: string
    content?: string
    nodes?: SrlNode[]
    initialState?: boolean
  }>(),
  { id: 'srl-page__dialog', header: '', content: '', nodes: undefined, initialState: false },
)

const emit = defineEmits<{ (e: 'open' | 'close'): void }>()

const dialogState = defineModel<boolean>('open')
const dialog = ref<HTMLDialogElement | null>(null)
const header = ref(props.header)
const content = ref(props.content)
watch(() => props.header, (value) => (header.value = value))
watch(() => props.content, (value) => (content.value = value))

function sync(open: boolean) {
  const element = dialog.value
  if (!element) return
  if (open && !element.open) {
    element.showModal()
    nextTick(() => element.querySelector<HTMLElement>('.srl-dialog__main')?.focus())
  } else if (!open && element.open) {
    element.close()
  }
}

watch(dialogState, (open) => {
  sync(!!open)
  emit(open ? 'open' : 'close')
})

onMounted(() => {
  if (dialogState.value === undefined) dialogState.value = props.initialState
  sync(!!dialogState.value)
})

function open() {
  dialogState.value = true
}

function close() {
  dialogState.value = false
}

function setDialogContent(template: string) {
  content.value = template
}

function setDialogContentAndOpen(template: string) {
  setDialogContent(template)
  open()
}

function clearContent() {
  header.value = ''
  content.value = ''
}

defineExpose({ $el: dialog, dialogState, open, close, setDialogContent, setDialogContentAndOpen, clearContent })
</script>

<template>
  <dialog
    :id="id"
    ref="dialog"
    class="srl-page__dialog"
    aria-modal="true"
    @click.stop="close"
    @close="dialogState = false"
  >
    <SrlAriaTabChain @click.stop>
      <SrlPageDialogContent :header="header" :content="content" :nodes="nodes" @close="close">
        <template v-if="$slots.header" #header><slot name="header" /></template>
        <template v-if="$slots.main" #main><slot name="main" /></template>
        <template v-else-if="$slots.default" #main><slot /></template>
        <template v-if="$slots.footer" #footer><slot name="footer" /></template>
      </SrlPageDialogContent>
    </SrlAriaTabChain>
  </dialog>
</template>
