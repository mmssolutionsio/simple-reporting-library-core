// Compact, serialisable tree of an article. Created once by `prepareArticleHtml`
// (server at build time, browser in the preview) and rendered with `h()` – no Vue
// template compiler at runtime.

export type SrlAttrs = Record<string, string>

/** Value of a `:prop` binding: a literal or a path into the current slot scope. */
export type SrlBinding = { lit: unknown } | { ref: string[] }

/** Slot parameters from `v-slot="{ a, b }"` (names) or `v-slot="props"` (whole scope). */
export type SrlSlotScope = { names: string[] } | { name: string }

export interface SrlSlot {
  scope?: SrlSlotScope
  children: SrlNode[]
}

/** Plain element with dynamic children. */
export interface SrlElementNode {
  t: 'el'
  tag: string
  attrs: SrlAttrs
  children: SrlNode[]
}

/** Element whose whole subtree is static: rendered with innerHTML. */
export interface SrlHtmlNode {
  t: 'html'
  tag: string
  attrs: SrlAttrs
  html: string
}

/** Custom element (`srl-*`), resolved to a Vue component at render time. */
export interface SrlComponentNode {
  t: 'c'
  tag: string
  attrs: SrlAttrs
  bind: Record<string, SrlBinding>
  slots: Record<string, SrlSlot>
}

export type SrlNode = string | SrlElementNode | SrlHtmlNode | SrlComponentNode

export interface PreparedArticle {
  nodes: SrlNode[]
  /** Contents of inline <style> blocks, set per page with useHead. */
  styles: string[]
  /** uuids of dialog articles opened from this article. */
  dialogs: string[]
  /** Links that could not be resolved (shown by `srl doctor`). */
  unresolvedLinks: string[]
  warnings: string[]
}
