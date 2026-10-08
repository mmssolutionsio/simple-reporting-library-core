import { useState } from '#imports'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

export interface SrlDialogState {
  open: boolean
  /** Anchor to scroll to after opening. */
  anchor?: string
  /** id of the SrlArticleDialogButton that renders the dialog (client only). */
  owner?: string
}

/** Registry of dialog articles on the current page, keyed by `<locale>/<uuid>`. Reset on navigation. */
export function useSrlDialogRegistry() {
  return useState<Record<string, SrlDialogState>>('srl-dialogs', () => ({}))
}

/**
 * State of one dialog article. All buttons for the same key share it, so a note that is
 * linked several times on a page opens one dialog (SRL 1: utils/pageState dialog storage).
 */
export function useSrlDialog(key: MaybeRefOrGetter<string>) {
  const registry = useSrlDialogRegistry()
  const read = (): SrlDialogState | undefined => registry.value[toValue(key)]
  const write = (): SrlDialogState => (registry.value[toValue(key)] ??= { open: false })

  return {
    isOpen: computed(() => read()?.open ?? false),
    anchor: computed(() => read()?.anchor),
    owner: computed(() => read()?.owner),
    open(anchor?: string) {
      const state = write()
      state.anchor = anchor
      state.open = true
    },
    close() {
      const state = read()
      if (state) state.open = false
    },
    /** Makes `id` the renderer of the dialog unless another mounted button already is. */
    claim(id: string): boolean {
      const state = write()
      state.owner ??= id
      return state.owner === id
    },
    release(id: string) {
      const state = read()
      if (state?.owner === id) state.owner = undefined
    },
  }
}

/** Closes all dialogs (called on navigation). Mounted buttons claim their dialogs again. */
export function closeAllSrlDialogs() {
  useSrlDialogRegistry().value = {}
}
