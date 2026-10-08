export type SrlBreakpoints = Record<string, number>

/** SRL 1 default grid breakpoints (srl.config.json → grid.breakpoints). */
export const DEFAULT_BREAKPOINTS: SrlBreakpoints = {
  print: 0,
  'phone-pt': 0,
  'phone-ls': 576,
  'tablet-pt': 768,
  'tablet-ls': 992,
  desktop: 1200,
  'desktop-large': 1400,
}

/** Name of the largest breakpoint <= width (breakpoints in ascending order, as in SRL 1). */
export function viewportFor(width: number, breakpoints: SrlBreakpoints): string | null {
  let result: string | null = null
  for (const [name, min] of Object.entries(breakpoints)) {
    if (min <= width) result = name
    else break
  }
  return result
}
