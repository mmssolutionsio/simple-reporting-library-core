import { parseFragment } from 'parse5'
import type { DefaultTreeAdapterMap } from 'parse5'

type Node = DefaultTreeAdapterMap['childNode'] | DefaultTreeAdapterMap['documentFragment']

const SEARCHED_TAGS = new Set(['h1', 'h2', 'h3', 'p'])

/** Text of all h1, h2, h3 and p elements of an article (as SRL 1 composables/search.ts). */
export function extractSearchText(html: string): string {
  const parts: string[] = []
  const textOf = (node: Node): string =>
    node.nodeName === '#text'
      ? (node as DefaultTreeAdapterMap['textNode']).value
      : 'childNodes' in node
        ? node.childNodes.map(textOf).join('')
        : ''
  const walk = (node: Node) => {
    if ('tagName' in node && SEARCHED_TAGS.has(node.tagName)) {
      const text = textOf(node).replace(/\s+/g, ' ').trim()
      if (text) parts.push(text)
      return
    }
    if ('childNodes' in node) node.childNodes.forEach(walk)
  }
  walk(parseFragment(html))
  return parts.join(' ')
}
