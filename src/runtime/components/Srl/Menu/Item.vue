<script setup lang="ts">
/** `SrlMenuItem` – one entry of SrlMenu: internal link, external/file link, callback button or submenu toggle. */
import { computed, nextTick, ref, useId } from 'vue'
import { isRouterPath } from '../../../../shared/uri'
import type { SrlNavigationItem } from '../../../utils/menu'
import type { SrlMenuBackButtonItem } from '../Menu.vue'

const props = defineProps<{
  name: string
  item: SrlNavigationItem
  index: number | string
  disableTab: boolean
  disableTabIndex: boolean
  initOpen: number
  depth: number
  disableClasses: boolean
  backButtonEnabled: boolean
  backButtonLabel: (backPath: SrlNavigationItem[]) => string
  backButtonItem?: SrlMenuBackButtonItem
  backPath: SrlNavigationItem[]
  path: SrlNavigationItem[]
}>()

const breadcrumb = defineModel<SrlNavigationItem[]>('breadcrumb', { required: true })

const emit = defineEmits<{
  (e: 'toggle', payload: unknown): void
  (e: 'open' | 'close' | 'next' | 'prev', payload: { index: number | string }): void
  (e: 'link' | 'routerChange' | 'tab' | 'back'): void
}>()

const id = useId()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const menu = ref<any>(null)
const li = ref<HTMLLIElement>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clickable = ref<any>()
const opened = ref(false)

const internal = computed(() => !!props.item.href && isRouterPath(props.item.href))
const external = computed(() => !!props.item.href && /^https?:/.test(props.item.href))
const domElement = (): HTMLAnchorElement | HTMLButtonElement => clickable.value?.$el ?? clickable.value

const currentBackPath = computed<SrlNavigationItem[]>(() => {
  if (props.item.attributes?.class?.includes('srl-menu__link--back')) return props.backPath
  const { children: _children, callback: _callback, ...look } = props.item
  return [{ ...look }, ...props.backPath]
})

const currentPath = computed<SrlNavigationItem[]>(() => [...props.path, { ...props.item }])

function toggle() {
  emit('toggle', {
    element: domElement(),
    itemEl: li.value,
    menu: menu.value,
    menuEl: menu.value?.$el,
    opened: opened.value,
    props,
  })
}

function toggleAction() {
  opened.value = !opened.value
  if (opened.value) {
    breadcrumb.value = currentPath.value
    emit('open', { index: props.index })
    nextTick(() => menu.value?.$el?.focus())
  } else {
    menu.value?.closeAll()
  }
  props.item.callback?.(domElement(), li.value!, menu.value?.$el)
  toggle()
}

function close() {
  breadcrumb.value = props.path
  emit('close', { index: props.index })
}

function closeSub() {
  breadcrumb.value = props.path
  domElement()?.focus?.()
}

function tab(event: KeyboardEvent) {
  if (props.disableTab && event) {
    event.stopPropagation()
    event.preventDefault()
    opened.value = false
  }
  emit('tab')
}

function back(event: KeyboardEvent) {
  if (props.disableTab && event) {
    event.stopPropagation()
    event.preventDefault()
  }
  emit('back')
  toggle()
}

function internalLinkClick() {
  props.item.callback?.(domElement(), li.value!)
  emit('link')
  emit('routerChange')
}

function externalLinkClick() {
  props.item.callback?.(domElement(), li.value!)
  emit('link')
}

function callbackClick() {
  props.item.callback?.(domElement(), li.value!)
}

function closeItem() {
  if (opened.value) toggle()
  opened.value = false
  menu.value?.closeAll()
}

function findPath(): SrlNavigationItem[] | null {
  if (!opened.value) return null
  if (!props.item.children?.length) return currentPath.value
  let result = currentPath.value
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  menu.value?.items.forEach((item: any) => {
    if (item.opened) result = item.findPath() || result
  })
  return result
}

defineExpose({ opened, closeItem, findPath, $el: clickable, menu })

const attributes = computed(() => props.item.attributes ?? {})
const title = computed(() => props.item.title ?? props.item.label)
const ariaLabel = computed(() => (props.item.icon ? title.value : undefined))

const classListLi = computed(() =>
  props.disableClasses
    ? []
    : [
        'srl-menu__item',
        `srl-menu__item--level-${props.depth}`,
        props.item.children ? 'srl-menu__item--has-children' : 'srl-menu__item--has-no-children',
      ],
)

const classListItem = computed(() => {
  const result: string[] = []
  if (props.item.active) result.push('srl-menu__link--active')
  if (!props.disableClasses) result.push('srl-menu__link', `srl-menu__link--level-${props.depth}`)
  return result
})
</script>

<template>
  <li v-if="!item.children && item.href" ref="li" role="none" :class="classListLi">
    <NuxtLink
      v-if="internal"
      ref="clickable"
      tabindex="-1"
      role="menuitem"
      :to="item.href"
      :class="classListItem"
      :title="title"
      v-bind="attributes"
      @click="internalLinkClick"
      @keydown.left.stop.prevent="emit('prev', { index })"
      @keydown.up.stop.prevent="emit('prev', { index })"
      @keydown.down.stop.prevent="emit('next', { index })"
      @keydown.right.stop.prevent="emit('next', { index })"
      @keydown.tab.exact="tab"
      @keydown.shift.tab.exact="back"
      @keydown.esc.stop.prevent="close"
    >
      <SrlMenuItemContent :item="item" :depth="depth" :disable-classes="disableClasses" />
    </NuxtLink>
    <a
      v-else
      ref="clickable"
      tabindex="-1"
      role="menuitem"
      :href="item.href"
      :title="title"
      :class="classListItem"
      :aria-label="ariaLabel"
      :target="external ? '_blank' : undefined"
      v-bind="attributes"
      @click="externalLinkClick"
      @keydown.left.stop.prevent="emit('prev', { index })"
      @keydown.up.stop.prevent="emit('prev', { index })"
      @keydown.down.stop.prevent="emit('next', { index })"
      @keydown.right.stop.prevent="emit('next', { index })"
      @keydown.tab.exact="tab"
      @keydown.shift.tab.exact="back"
      @keydown.esc.stop.prevent="close"
    >
      <SrlMenuItemContent :item="item" :depth="depth" :disable-classes="disableClasses" />
    </a>
  </li>
  <li v-else-if="!item.children && item.callback" ref="li" role="none" :class="classListLi">
    <button
      ref="clickable"
      type="button"
      tabindex="-1"
      role="menuitem"
      :class="classListItem"
      :title="title"
      :aria-label="ariaLabel"
      v-bind="attributes"
      @click="callbackClick"
      @keydown.left.stop.prevent="emit('prev', { index })"
      @keydown.up.stop.prevent="emit('prev', { index })"
      @keydown.down.stop.prevent="emit('next', { index })"
      @keydown.right.stop.prevent="emit('next', { index })"
      @keydown.tab.exact="tab"
      @keydown.shift.tab.exact="back"
      @keydown.esc.stop.prevent="close"
    >
      <SrlMenuItemContent :item="item" :depth="depth" :disable-classes="disableClasses" />
    </button>
  </li>
  <li v-else ref="li" role="none" :class="classListLi">
    <button
      ref="clickable"
      type="button"
      tabindex="-1"
      role="menuitem"
      :aria-haspopup="item.children ? 'true' : 'false'"
      :aria-expanded="opened"
      :aria-controls="item.children ? `${name}-${id}` : undefined"
      :class="classListItem"
      :title="title"
      :aria-label="ariaLabel"
      v-bind="attributes"
      @click.stop="toggleAction"
      @keydown.left.stop.prevent="emit('prev', { index })"
      @keydown.up.stop.prevent="emit('prev', { index })"
      @keydown.down.stop.prevent="emit('next', { index })"
      @keydown.right.stop.prevent="emit('next', { index })"
      @keydown.tab.exact="tab"
      @keydown.shift.tab.exact="back"
      @keydown.esc.stop.prevent="close"
    >
      <SrlMenuItemContent :item="item" :depth="depth" :disable-classes="disableClasses" />
    </button>
    <SrlMenu
      v-if="item.children"
      :id="`${name}-${id}`"
      ref="menu"
      v-model:opened="opened"
      v-model:breadcrumb="breadcrumb"
      :name="name"
      :menu="item.children"
      :disable-tab="disableTab"
      :init-open="initOpen"
      :depth="depth + 1"
      :disable-classes="disableClasses"
      :back-button-enabled="backButtonEnabled"
      :back-button-label="backButtonLabel"
      :back-button-item="backButtonItem"
      :path="currentPath"
      :back-path="currentBackPath"
      @link="emit('link')"
      @router-change="emit('routerChange')"
      @tab="emit('tab')"
      @close-sub="closeSub"
      @toggle="(payload: unknown) => emit('toggle', payload)"
      @back-button-click="toggle"
    />
  </li>
</template>
