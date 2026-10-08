import { useNuxtApp } from '#imports'
import type { Composer, I18n } from 'vue-i18n'

/**
 * Global vue-i18n composer of the app (works outside components, e.g. in composables).
 * In components `useI18n()` from vue-i18n and `$t` work as well.
 */
export function useSrlI18n(): Composer {
  return (useNuxtApp().$srlI18n as I18n<{}, {}, {}, string, false>).global as unknown as Composer
}
