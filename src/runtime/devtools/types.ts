/** Settings shared by the SRL tab in the Nuxt DevTools and the overlay on the page. */
export type SrlDevToolsSettings = {
  /** Grid columns over the page. */
  grid: boolean
  /** Opacity of the grid columns (0.02–0.3). */
  gridOpacity: number
  /** Small badge with breakpoint and width. */
  badge: boolean
  badgePosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  /** Dark theme of the tab. */
  darkMode: boolean
}

export type SrlDevToolsMessage = { type: 'viewport'; width: number } | { type: 'request-viewport' }
