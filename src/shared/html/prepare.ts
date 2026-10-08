import { parseFragment, serialize } from 'parse5'
import type { DefaultTreeAdapterMap } from 'parse5'
import { resolveLink } from '../links/resolveLink'
import type { RouteTable } from '../routes/buildRouteTable'
import type { PreparedArticle, SrlAttrs, SrlBinding, SrlComponentNode, SrlNode, SrlSlotScope } from './nodes'

type ParentNode = DefaultTreeAdapterMap['parentNode']
type ChildNode = DefaultTreeAdapterMap['childNode']
type Element = DefaultTreeAdapterMap['element']
type TextNode = DefaultTreeAdapterMap['textNode']

export interface PrepareContext {
  table: RouteTable
  locale: string
  /** Base URL of the site with trailing slash (Nuxt app.baseURL), e.g. "/report/". */
  base: string
  /** Rewrite links and asset paths (default). Disabled only to compare with the plain SRL 1 template. */
  rewriteLinks?: boolean
}

/** Tag of the component that opens a dialog article (SRL 1: srl-article-dialog-button). */
export const DIALOG_BUTTON_TAG = 'srl-article-dialog-button'

const ASSET_ATTRIBUTES = ['src', 'href', 'poster', 'data-src']
const ASSET_PREFIX = /^\.\/(images|downloads)\//
const IDENTIFIER_PATH = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/

const isElement = (node: ChildNode | ParentNode): node is Element => 'tagName' in node
const isText = (node: ChildNode): node is TextNode => node.nodeName === '#text'
const isComponentTag = (tag: string) => tag.includes('-') && !tag.startsWith('template-')

/**
 * Turns an nswow article HTML fragment into a render tree.
 * Port of SRL 1 srl/.srl/utils/html.ts (prepareHtmlContent) without the runtime compiler:
 * - inline <style> → `styles`
 * - popup links and links to dialog articles → dialog button component
 * - internal links → final URLs of the route table (navigation hierarchy, base)
 * - ./images/ and ./downloads/ → base-absolute URLs
 * - srl-* custom elements → component nodes with `:prop` bindings, `v-slot` scopes and
 *   `<template-x>` named slots
 * - line breaks in table cell spans → <br>
 */
export function prepareArticleHtml(html: string, ctx: PrepareContext): PreparedArticle {
  const result: PreparedArticle = { nodes: [], styles: [], dialogs: [], unresolvedLinks: [], warnings: [] }
  const fragment = parseFragment(html)

  transform(fragment, ctx, result, false)
  condenseWhitespace(fragment)
  result.nodes = toNodes(fragment, result)
  result.dialogs = [...new Set(result.dialogs)]
  result.unresolvedLinks = [...new Set(result.unresolvedLinks)]
  return result
}

/** Rewrites the parse5 tree in place. */
function transform(parent: ParentNode, ctx: PrepareContext, result: PreparedArticle, inTableCell: boolean) {
  for (const node of [...parent.childNodes]) {
    if (!isElement(node)) {
      if (node.nodeName === '#comment') removeNode(parent, node)
      continue
    }

    if (node.tagName === 'style') {
      const css = node.childNodes.filter(isText).map((t) => t.value).join('')
      if (css.trim()) result.styles.push(css)
      removeNode(parent, node)
      continue
    }

    // `ref` only made sense inside the SRL 1 runtime template
    removeAttr(node, 'ref')
    if (ctx.rewriteLinks !== false) {
      rewriteAssets(node, ctx.base)
      if (node.tagName === 'a') rewriteLink(node, ctx, result)
    }

    const cell = inTableCell || node.tagName === 'td' || node.tagName === 'th'
    if (cell && node.tagName === 'span') preserveLineBreaks(node)

    transform(node, ctx, result, cell)
  }
}

function rewriteAssets(node: Element, base: string) {
  for (const attr of node.attrs) {
    if (ASSET_ATTRIBUTES.includes(attr.name) && ASSET_PREFIX.test(attr.value)) {
      attr.value = base + attr.value.slice(2)
    } else if (attr.name === 'srcset') {
      attr.value = attr.value
        .split(',')
        .map((candidate) => {
          const trimmed = candidate.trim()
          return ASSET_PREFIX.test(trimmed) ? base + trimmed.slice(2) : trimmed
        })
        .join(', ')
    }
  }
}

function rewriteLink(node: Element, ctx: PrepareContext, result: PreparedArticle) {
  const href = getAttr(node, 'href')
  const articleName = getAttr(node, 'data-article-name')
  if (href === undefined && articleName === undefined) return

  const resolved = resolveLink(
    href ?? '',
    { articleName, noteTarget: getAttr(node, 'data-note-target') },
    ctx.table,
    ctx.locale,
  )

  switch (resolved.type) {
    case 'dialog': {
      // <a> → <srl-article-dialog-button uuid anchor> (handled as component node later)
      node.tagName = DIALOG_BUTTON_TAG
      node.nodeName = DIALOG_BUTTON_TAG
      removeAttr(node, 'href')
      removeAttr(node, 'data-article-name')
      setAttr(node, 'uuid', resolved.uuid)
      if (resolved.hash) setAttr(node, 'anchor', resolved.hash)
      result.dialogs.push(resolved.uuid)
      break
    }
    case 'route':
      setAttr(node, 'href', ctx.base + resolved.path.slice(1) + (resolved.hash ? `#${resolved.hash}` : ''))
      removeAttr(node, 'data-article-name')
      break
    case 'unresolved':
      if (href) result.unresolvedLinks.push(href)
      break
    // anchors, external links and files stay as they are (files were rewritten by rewriteAssets)
  }
}

function preserveLineBreaks(element: Element) {
  for (const child of [...element.childNodes]) {
    if (isElement(child)) {
      preserveLineBreaks(child)
      continue
    }
    if (!isText(child) || !/[\r\n]/.test(child.value)) continue
    const replacement: ChildNode[] = []
    child.value.split(/\r\n|\r|\n/).forEach((part, index) => {
      if (index > 0) replacement.push(createElement('br', element))
      if (part) replacement.push({ nodeName: '#text', value: part, parentNode: element } as TextNode)
    })
    element.childNodes.splice(element.childNodes.indexOf(child), 1, ...replacement)
  }
}

const PRESERVE_WHITESPACE = new Set(['pre', 'textarea', 'script'])
const WHITESPACE_ONLY = /^[\t\r\n\f ]*$/

/**
 * Same whitespace handling as the Vue template compiler (`whitespace: 'condense'`), which
 * SRL 1 used through vue3-runtime-template: whitespace-only text between elements is removed
 * when it contains a line break or sits at the start/end, all other runs become one space.
 */
function condenseWhitespace(parent: ParentNode) {
  if (isElement(parent) && PRESERVE_WHITESPACE.has(parent.tagName)) return
  const children = parent.childNodes
  for (let i = 0; i < children.length; i++) {
    const node = children[i]!
    if (isElement(node)) {
      condenseWhitespace(node)
      continue
    }
    if (!isText(node)) continue
    if (WHITESPACE_ONLY.test(node.value)) {
      const prev = children[i - 1]
      const next = children[i + 1]
      if (!prev || !next || (isElement(prev) && isElement(next) && /[\r\n]/.test(node.value))) {
        children.splice(i--, 1)
      } else {
        node.value = ' '
      }
    } else {
      node.value = node.value.replace(/[\t\r\n\f ]+/g, ' ')
    }
  }
}

/** Converts the transformed parse5 tree into SrlNodes, collapsing static subtrees. */
function toNodes(parent: ParentNode, result: PreparedArticle): SrlNode[] {
  const nodes: SrlNode[] = []
  for (const node of parent.childNodes) {
    if (isText(node)) {
      nodes.push(node.value)
    } else if (isElement(node)) {
      if (node.tagName.startsWith('template-')) {
        result.warnings.push(`<${node.tagName}> outside of a component is ignored.`)
        continue
      }
      nodes.push(toNode(node, result))
    }
  }
  return nodes
}

function toNode(node: Element, result: PreparedArticle): SrlNode {
  if (isComponentTag(node.tagName)) return toComponent(node, result)

  const attrs = plainAttrs(node, result)
  if (node.childNodes.length === 0 && node.tagName !== 'template') {
    return { t: 'el', tag: node.tagName, attrs, children: [] }
  }
  if (!hasDynamicDescendant(node)) {
    const content = node.tagName === 'template' ? (node as DefaultTreeAdapterMap['template']).content : node
    return { t: 'html', tag: node.tagName, attrs, html: serialize(content) }
  }
  return { t: 'el', tag: node.tagName, attrs, children: toNodes(node, result) }
}

function toComponent(node: Element, result: PreparedArticle): SrlComponentNode {
  const component: SrlComponentNode = { t: 'c', tag: node.tagName, attrs: {}, bind: {}, slots: {} }
  let defaultScope: SrlSlotScope | undefined

  for (const { name, value } of node.attrs) {
    if (name === 'v-slot' || name === '#default') {
      defaultScope = parseSlotScope(value, node.tagName, result)
    } else if (name.startsWith(':') || name.startsWith('v-bind:')) {
      const prop = name.slice(name.indexOf(':') + 1)
      const binding = parseBinding(value)
      if (binding) component.bind[prop] = binding
      else result.warnings.push(`Unsupported binding ${name}="${value}" on <${node.tagName}> is ignored.`)
    } else if (name.startsWith('v-') || name.startsWith('@')) {
      result.warnings.push(`Unsupported directive ${name} on <${node.tagName}> is ignored.`)
    } else {
      component.attrs[name] = value
    }
  }

  const defaultChildren: ChildNode[] = []
  for (const child of node.childNodes) {
    if (isElement(child) && child.tagName.startsWith('template-')) {
      const slotName = child.tagName.slice('template-'.length)
      const scopeAttr = getAttr(child, 'v-slot')
      component.slots[slotName] = {
        ...(scopeAttr ? { scope: parseSlotScope(scopeAttr, child.tagName, result) } : {}),
        children: toNodes(child, result),
      }
    } else {
      defaultChildren.push(child)
    }
  }

  const children = toNodes({ ...node, childNodes: defaultChildren } as Element, result)
  if (children.some((c) => typeof c !== 'string' || c.trim())) {
    component.slots.default = { ...(defaultScope ? { scope: defaultScope } : {}), children }
  }
  return component
}

function plainAttrs(node: Element, result: PreparedArticle): SrlAttrs {
  const attrs: SrlAttrs = {}
  for (const { name, value } of node.attrs) {
    if (name.startsWith(':') || name.startsWith('v-') || name.startsWith('@')) {
      result.warnings.push(`Vue syntax ${name} on plain element <${node.tagName}> is ignored.`)
      continue
    }
    attrs[name] = value
  }
  return attrs
}

function hasDynamicDescendant(node: ParentNode): boolean {
  return node.childNodes.some(
    (child) =>
      isElement(child) &&
      (isComponentTag(child.tagName) ||
        child.tagName.startsWith('template-') ||
        child.attrs.some((a) => a.name.startsWith(':') || a.name.startsWith('v-')) ||
        hasDynamicDescendant(child)),
  )
}

export function parseBinding(value: string): SrlBinding | undefined {
  const trimmed = value.trim()
  try {
    return { lit: JSON.parse(trimmed) }
  } catch {
    // not JSON
  }
  if (/^'[^']*'$/.test(trimmed)) return { lit: trimmed.slice(1, -1) }
  if (IDENTIFIER_PATH.test(trimmed)) return { ref: trimmed.split('.') }
  return undefined
}

function parseSlotScope(value: string, tag: string, result: PreparedArticle): SrlSlotScope | undefined {
  const trimmed = value.trim()
  const destructured = /^\{\s*([\w$]+(?:\s*,\s*[\w$]+)*)\s*\}$/.exec(trimmed)
  if (destructured) return { names: destructured[1]!.split(',').map((n) => n.trim()) }
  if (/^[\w$]+$/.test(trimmed)) return { name: trimmed }
  if (trimmed) result.warnings.push(`Unsupported slot scope "${value}" on <${tag}> is ignored.`)
  return undefined
}

function getAttr(node: Element, name: string): string | undefined {
  return node.attrs.find((a) => a.name === name)?.value
}

function setAttr(node: Element, name: string, value: string) {
  const attr = node.attrs.find((a) => a.name === name)
  if (attr) attr.value = value
  else node.attrs.push({ name, value })
}

function removeAttr(node: Element, name: string) {
  node.attrs = node.attrs.filter((a) => a.name !== name)
}

function removeNode(parent: ParentNode, node: ChildNode) {
  parent.childNodes.splice(parent.childNodes.indexOf(node), 1)
}

function createElement(tagName: string, parentNode: Element): Element {
  return {
    nodeName: tagName,
    tagName,
    attrs: [],
    namespaceURI: parentNode.namespaceURI,
    childNodes: [],
    parentNode,
  } as Element
}
