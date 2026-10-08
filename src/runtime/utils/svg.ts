// SVG strings for menus and buttons, parsed without DOMParser so they render on the server too.

export interface ParsedSvg {
  attrs: Record<string, string>
  inner: string
}

/** True when the string is SVG markup or an SVG data URI (otherwise it is treated as URL). */
export function isInlineSvg(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.startsWith('data:image/svg+xml,') || /^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(trimmed)
}

/** Splits `<svg …>…</svg>` (or a data:image/svg+xml, URI) into root attributes and inner markup. */
export function parseSvg(value: string): ParsedSvg | undefined {
  let markup = value.trim()
  if (markup.startsWith('data:image/svg+xml,')) markup = decodeURIComponent(markup.slice('data:image/svg+xml,'.length))
  const match = /<svg\b([^>]*)>([\s\S]*)<\/svg>/i.exec(markup)
  if (!match) return undefined
  const attrs: Record<string, string> = {}
  for (const [, name, double, single, bare] of match[1]!.matchAll(/([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    attrs[name!] = double ?? single ?? bare ?? ''
  }
  return { attrs, inner: match[2]! }
}
