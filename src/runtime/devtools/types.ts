/** Settings shared by the SRL tab in the Nuxt DevTools and the overlay on the page. */
export type SrlDevToolsSettings = {
  /** Grid columns over the page. */
  grid: boolean
  /** Opacity of the grid columns (0.02–0.3). */
  gridOpacity: number
  /** Small badge with breakpoint and width. */
  badge: boolean
  /** Edge the badge snaps to after dragging, and its position along that edge (0–100 %). */
  badgeSide: 'top' | 'bottom' | 'left' | 'right'
  badgeOffset: number
  /** Theme of the tab: `auto` follows the Nuxt DevTools. */
  theme: 'auto' | 'light' | 'dark'
}

export type SrlDevToolsMessage = { type: 'viewport'; width: number } | { type: 'request-viewport' }
