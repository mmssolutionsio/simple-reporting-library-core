<script setup lang="ts">
/**
 * `SrlMenu` – hierarchical, keyboard accessible menu (ported from SRL 1).
 *
 * Items usually come from `useSrlMenu(name)`; any SrlNavigationItem[] works (callbacks,
 * icons, images, svgs). Emits as in SRL 1: toggle, backButtonClick, close, closeSub, link,
 * routerChange, nextExceeded, prevExceeded, tab, back. Exposes closeAll, $el, items, breadcrumb.
 */
import { computed, ref } from 'vue'
import type { SrlNavigationItem } from '../../utils/menu'

export interface SrlMenuBackButtonItem {
  title?: string
  img?: { src: string; alt?: string }
  imgBefore?: { src: string; alt?: string }
  imgAfter?: { src: string; alt?: string }
  icon?: string
  iconBefore?: string
  iconAfter?: string
  svg?: string | object
  svgBefore?: string | object
  svgAfter?: string | object
  attributes?: Record<string, string>
}

const props = withDefaults(
  defineProps<{
    name: string
    menu: SrlNavigationItem[]
    id?: string
    disableTab?: boolean
    disableTabIndex?: boolean
    initOpen?: number
    singleOpen?: boolean
    depth?: number
    disableClasses?: boolean
    backButtonEnabled?: boolean
    backButtonLabel?: (backPath: SrlNavigationItem[]) => string
    backButtonItem?: SrlMenuBackButtonItem
    path?: SrlNavigationItem[]
    backPath?: SrlNavigationItem[]
  }>(),
  {
    disableTab: false,
    disableTabIndex: false,
    initOpen: 0,
    singleOpen: true,
    depth: 0,
    disableClasses: false,
    backButtonEnabled: false,
    backButtonLabel: (backPath: SrlNavigationItem[]) => backPath[0]?.label ?? 'Back',
    backButtonItem: undefined,
    id: undefined,
    path: undefined,
    backPath: undefined,
  },
)

const emit = defineEmits<{
  (e: 'toggle', payload: unknown): void
  (e: 'backButtonClick' | 'close' | 'closeSub' | 'link' | 'routerChange' | 'nextExceeded' | 'prevExceeded' | 'tab' | 'back'): void
}>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const items = ref<any[]>([])
const rootEl = ref<HTMLUListElement>()

const opened = defineModel<boolean>('opened', { default: true })
const breadcrumb = defineModel<SrlNavigationItem[]>('breadcrumb', { default: () => [] })

function open(event: { index: number | string }) {
  if (props.singleOpen) closeAll(event.index)
}

function close() {
  if (props.initOpen < props.depth) {
    opened.value = false
    emit('closeSub')
  } else {
    emit('close')
  }
}

function focusItem(index: number) {
  const el = items.value[index]?.$el
  if (!el) return
  if (el.$el) el.$el.focus()
  else el.focus?.()
}

function next(event: { index: number | string }) {
  let index = Number(event.index) + 1
  const exceeded = index >= items.value.length
  if (exceeded) index = 0
  focusItem(index)
  if (exceeded) emit('nextExceeded')
}

function prev(event: { index: number | string }) {
  let index = Number(event.index) - 1
  const exceeded = index < 0
  if (exceeded) index = items.value.length - 1
  focusItem(index)
  if (exceeded) emit('prevExceeded')
}

function closeAll(keep?: number | string) {
  let currentPath: SrlNavigationItem[] | null = null
  items.value.forEach((item, index) => {
    if (keep !== index) item.closeItem()
    const path = item.findPath()
    if (path) currentPath = path
  })
  breadcrumb.value = currentPath ?? (props.path?.length ? props.path.slice(0, -1) : [])
}

const menuItems = computed<SrlNavigationItem[]>(() => {
  if (!(props.backButtonEnabled && props.depth && props.backButtonItem)) return props.menu
  const { attributes, ...look } = props.backButtonItem
  const classes = (attributes?.class ?? '').split(' ').filter(Boolean)
  classes.push('srl-menu__link--back')
  const backItem: SrlNavigationItem = {
    ...look,
    label: props.backButtonLabel(props.backPath ?? []),
    attributes: {
      ...(attributes ?? {}),
      class: classes.join(' '),
      'aria-controls': props.id ?? '',
      'aria-expanded': String(opened.value),
    },
    callback: () => {
      close()
      emit('backButtonClick')
    },
  }
  return [backItem, ...props.menu]
})

const classList = computed(() => (props.disableClasses ? [] : ['srl-menu', `srl-menu--level-${props.depth}`]))

defineExpose({ closeAll, $el: rootEl, items, breadcrumb })
</script>

<template>
  <ul
    :id="props.id"
    ref="rootEl"
    tabindex="0"
    :role="props.depth === 0 ? 'menubar' : 'menu'"
    :class="classList"
    :hidden="!opened"
    @keydown.esc.prevent.stop="close"
    @keydown.up.prevent.stop="focusItem(menuItems.length - 1)"
    @keydown.right.prevent.stop="focusItem(0)"
    @keydown.down.prevent.stop="focusItem(0)"
    @keydown.left.prevent.stop="focusItem(menuItems.length - 1)"
  >
    <template v-for="(item, index) in menuItems" :key="index">
      <SrlMenuItem
        ref="items"
        v-model:breadcrumb="breadcrumb"
        :item="item"
        :name="props.name"
        :index="index"
        :disable-tab="props.disableTab"
        :disable-tab-index="props.disableTabIndex"
        :init-open="props.initOpen"
        :depth="props.depth"
        :disable-classes="props.disableClasses"
        :back-button-enabled="props.backButtonEnabled"
        :back-button-label="props.backButtonLabel"
        :back-button-item="props.backButtonItem"
        :path="props.path ?? []"
        :back-path="props.backPath ?? []"
        @open="open"
        @close="close"
        @next="next"
        @prev="prev"
        @tab="emit('tab')"
        @back="emit('back')"
        @link="emit('link')"
        @router-change="emit('routerChange')"
        @toggle="(payload: unknown) => emit('toggle', payload)"
      />
    </template>
  </ul>
</template>
