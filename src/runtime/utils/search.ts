// Pure search logic (no Nuxt, no DOM). Port of the matching of SRL 1
// (livingdocs 020.search/search.vue on top of composables/search.ts).

/** Entry of the prebuilt search index /_srl/search/<locale>.json. */
export interface SrlSearchEntry {
  uuid: string
  path: string
  title: string
  text: string
}

export interface SrlSearchOptions {
  /** Minimum length of the whole query (SRL 1 default 3). */
  minLength?: number
  /** Characters shown around a hit (default 50). */
  charsAround?: number
  /** Hits closer than this many characters form one snippet (default 50). */
  wordsDistance?: number
  /** Wrap the hits in <b> (settings.search.boldTheWord, default true). */
  boldTheWord?: boolean
}

export interface SrlSearchResult {
  entry: SrlSearchEntry
  /** Plain snippet text (empty when the page only matched by title). */
  text: string
  /** Escaped snippet HTML with <b> around the hits (if boldTheWord). */
  html: string
}

interface WordIndex {
  index: number
  word: string
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]!)

/** Search words of a query: split on whitespace, empty parts removed. */
export function searchWords(query: string): string[] {
  return query
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
}

/**
 * A page matches when every word occurs in its text, or the whole query occurs in its title
 * (case-insensitive, words are matched literally – SRL 1 used them as regular expressions).
 */
export function matchesSearch(entry: SrlSearchEntry, query: string): boolean {
  const words = searchWords(query)
  if (!words.length) return false
  const inText = words.every((word) => new RegExp(escapeRegExp(word), 'i').test(entry.text))
  return inText || new RegExp(escapeRegExp(query.trim()), 'i').test(entry.title)
}

/** Groups word positions into ranges; a range collects words within `distance` of its first word. */
function findRanges(text: string, words: string[], distance: number): WordIndex[][] {
  const indexes = words
    .map((word) => ({ index: text.search(new RegExp(escapeRegExp(word), 'i')), word }))
    .filter((item) => item.index !== -1)
    .sort((a, b) => a.index - b.index)
  const ranges: WordIndex[][] = []
  let range: WordIndex[] = []
  for (const item of indexes) {
    if (range.length && range[0]!.index + distance <= item.index) {
      ranges.push(range)
      range = []
    }
    range.push(item)
  }
  if (range.length) ranges.push(range)
  return ranges
}

function extractText(text: string, first: WordIndex, last: WordIndex, charsAround: number): string {
  const start = first.index - charsAround
  const end = last.index + charsAround
  return (start > 0 ? '...' : '') + text.substring(Math.max(start, 0), end) + (end < text.length ? '...' : '')
}

/** Snippet of a matching page: the text around all hits, hits highlighted. */
export function searchSnippet(text: string, query: string, options: SrlSearchOptions = {}): { text: string; html: string } {
  const charsAround = options.charsAround ?? 50
  const words = searchWords(query)
  const ranges = findRanges(text, words, options.wordsDistance ?? 50)
  if (!ranges.length) return { text: '', html: '' }
  const snippet = ranges.map((range) => extractText(text, range[0]!, range[range.length - 1]!, charsAround)).join(' ')
  let html = escapeHtml(snippet)
  if (options.boldTheWord ?? true) {
    const found = [...new Set(ranges.flat().map((item) => item.word))]
    const expression = found.map((word) => escapeRegExp(escapeHtml(word))).join('|')
    html = html.replace(new RegExp(`(${expression})`, 'gi'), '<b>$1</b>')
  }
  return { text: snippet, html }
}

/** Searches the index; results keep the index order (= routing order). */
export function searchIndex(index: SrlSearchEntry[], query: string, options: SrlSearchOptions = {}): SrlSearchResult[] {
  if (query.trim().length < (options.minLength ?? 3)) return []
  return index
    .filter((entry) => matchesSearch(entry, query))
    .map((entry) => ({ entry, ...searchSnippet(entry.text, query, options) }))
}
