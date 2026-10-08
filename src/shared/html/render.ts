import { defineComponent, h, inject, type Component, type InjectionKey, type PropType, type VNodeChild } from 'vue'
import type { SrlBinding, SrlNode, SrlSlotScope } from './nodes'

/** Maps custom tags of the nswow HTML (e.g. `srl-ld-table`) to Vue components. */
export type SrlComponentResolver = (tag: string) => Component | undefined

export const SRL_HTML_RESOLVER: InjectionKey<SrlComponentResolver> = Symbol('srl-html-resolver')

type Scope = Record<string, unknown>

export interface RenderOptions {
  resolve: SrlComponentResolver
  warn?: (message: string) => void
}

export function renderNodes(nodes: SrlNode[], options: RenderOptions, scope: Scope = {}): VNodeChild[] {
  return nodes.map((node) => renderNode(node, options, scope))
}

function renderNode(node: SrlNode, options: RenderOptions, scope: Scope): VNodeChild {
  if (typeof node === 'string') return node

  switch (node.t) {
    case 'html':
      return h(node.tag, { ...node.attrs, innerHTML: node.html })
    case 'el':
      return h(node.tag, node.attrs, renderNodes(node.children, options, scope))
    case 'c': {
      const props: Record<string, unknown> = { ...node.attrs }
      for (const [name, binding] of Object.entries(node.bind)) {
        props[name] = evaluate(binding, scope)
      }

      const component = options.resolve(node.tag)
      if (!component) {
        options.warn?.(`No component registered for <${node.tag}>, rendered as plain element.`)
        return h(node.tag, node.attrs, node.slots.default ? renderNodes(node.slots.default.children, options, scope) : [])
      }

      const slots: Record<string, (slotProps?: Scope) => VNodeChild[]> = {}
      for (const [name, slot] of Object.entries(node.slots)) {
        slots[name] = (slotProps: Scope = {}) =>
          renderNodes(slot.children, options, extendScope(scope, slot.scope, slotProps))
      }
      return h(component, props, slots)
    }
  }
}

function evaluate(binding: SrlBinding, scope: Scope): unknown {
  if ('lit' in binding) return binding.lit
  let value: unknown = scope
  for (const key of binding.ref) {
    value = value == null ? undefined : (value as Scope)[key]
  }
  return value
}

function extendScope(scope: Scope, slotScope: SrlSlotScope | undefined, slotProps: Scope): Scope {
  if (!slotScope) return scope
  if ('name' in slotScope) return { ...scope, [slotScope.name]: slotProps }
  const extended = { ...scope }
  for (const name of slotScope.names) extended[name] = slotProps[name]
  return extended
}

/** Renders prepared article nodes. Components are resolved via `resolve` or the injected resolver. */
export const SrlHtml = defineComponent({
  name: 'SrlHtml',
  props: {
    nodes: { type: Array as PropType<SrlNode[]>, required: true },
    resolve: { type: Function as PropType<SrlComponentResolver>, default: undefined },
  },
  setup(props) {
    // missing components are reported by the resolver (once per tag)
    const injected = inject(SRL_HTML_RESOLVER, undefined)
    return () => renderNodes(props.nodes, { resolve: (tag) => (props.resolve ?? injected)?.(tag) })
  },
})
