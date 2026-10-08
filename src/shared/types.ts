// Data contracts of the nswow export (data/json, data/downloads).
// Ported from SRL 1 srl/.srl/types/nswow.d.ts.

export interface NsWowSettings {
  version?: string
  languages: string[]
  defaultLanguage: string
  shortBreadcrumb: boolean
  search: { boldTheWord: boolean }
  categories: string[]
  publicationName: Record<string, string>
}

export interface NsWowArticle {
  uuid: string
  name: string
  translatedTitle: string
  slug: string
  index: boolean
  seo_keywords?: string[]
  ignoreInSearch?: boolean
  excerpt?: string
  originalLanguageOfArticle?: string
  /** Special page rendered by a component instead of article HTML (Search, DownloadCenter, ErrorView). */
  component?: string
  excludeFromPdf?: boolean
  excludeFromWord?: boolean
  excludeFromTranslate?: boolean
  [key: string]: unknown
}

export type NsWowMenuType = 'MenuEntry' | 'Article' | 'ExternalLink' | (string & {})

export interface NsWowMenu {
  label: string
  type: NsWowMenuType
  page?: string
  url?: string
  anchor?: string
  submenuEntries?: NsWowMenu[]
}

export interface NsWowRouting {
  version: string
  pages: NsWowArticle[]
  menu: Record<string, NsWowMenu[]>
}

export type NsWowTranslations = Record<string, Record<string, unknown>>

export interface NsWowDownload {
  type: string
  title: string
  fileType?: string
  size?: string
  artifact?: string
}

export interface NsWowDownloads {
  version?: string
  structure: NsWowDownload[]
  [key: string]: unknown
}
