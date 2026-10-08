import { defineNuxtPlugin, useRouter } from '#imports'
import projectMessages from '#build/srl/locales.mjs'
import { createI18n } from 'vue-i18n'
import { useSrlManifest } from '../composables/srl'
import { deepMerge } from '../utils/object'

/**
 * vue-i18n (not @nuxtjs/i18n: locales come from the data and the locale prefix is already part
 * of the route table). One instance per app/request. Messages: project `app/locales/<locale>.json`
 * deep-merged with json/translations_hosting.json (nswow wins). The locale follows the first
 * path segment.
 */
export default defineNuxtPlugin({
  name: 'srl-i18n',
  dependsOn: ['srl-data'],
  setup(nuxtApp) {
    const { table, translations } = useSrlManifest()
    const project = projectMessages as Record<string, Record<string, unknown>>
    const locales = [...new Set([...table.locales, ...Object.keys(project)])]
    const messages = Object.fromEntries(locales.map((locale) => [locale, deepMerge(project[locale], translations[locale])]))
    const localeOf = (path: string) => {
      const first = path.split('/')[1] ?? ''
      return table.locales.includes(first) ? first : table.defaultLocale
    }

    const i18n = createI18n({
      legacy: false,
      globalInjection: true,
      locale: table.defaultLocale,
      fallbackLocale: table.defaultLocale,
      messages,
      fallbackWarn: false,
      missingWarn: import.meta.dev,
    })
    nuxtApp.vueApp.use(i18n)

    // the initial navigation runs after all plugins (app:created), so this also sets the SSR locale
    useRouter().beforeEach((to) => {
      i18n.global.locale.value = localeOf(to.path)
    })

    return { provide: { srlI18n: i18n } }
  },
})
