import { useState } from '#imports'
import type { Ref } from 'vue'

/**
 * true once an accordion opened for the URL hash scrolled into view, so only the first one
 * scrolls (SRL 1: utils/pageState accordionAnchored). Reset on navigation.
 */
export function useSrlAccordionAnchored(): Ref<boolean> {
  return useState('srl-accordion-anchored', () => false)
}
