import { useNuxtApp, useState } from '#imports'
import { computed, type ComputedRef } from 'vue'
import { DEFAULT_BREAKPOINTS, viewportFor, type SrlBreakpoints } from '../utils/viewport'
import { useSrlConfig } from './srl'

export interface SrlViewport {
  breakPoints: SrlBreakpoints
  /** Window width; 0 on the server and until the app is mounted (keeps hydration stable). */
  innerWidth: number
  /** Largest breakpoint <= innerWidth, null before mount. */
  viewPort: string | null
}

/**
 * Current viewport by breakpoint name. Breakpoints: argument, else runtime config
 * `public.srl.breakpoints`, else the SRL 1 defaults. One resize listener per app.
 */
export function useSrlViewport(breakpoints?: SrlBreakpoints): ComputedRef<SrlViewport> {
  const width = useState('srl-viewport-width', () => 0)
  const points = breakpoints ?? useSrlConfig().breakpoints ?? DEFAULT_BREAKPOINTS

  if (import.meta.client) {
    const nuxtApp = useNuxtApp() as unknown as { _srlViewport?: boolean; isHydrating?: boolean; hook: Function }
    if (!nuxtApp._srlViewport) {
      nuxtApp._srlViewport = true
      const update = () => (width.value = window.innerWidth)
      window.addEventListener('resize', update, { passive: true })
      if (nuxtApp.isHydrating) nuxtApp.hook('app:suspense:resolve', update)
      else update()
    }
  }

  return computed(() => ({
    breakPoints: points,
    innerWidth: width.value,
    viewPort: width.value ? viewportFor(width.value, points) : null,
  }))
}
