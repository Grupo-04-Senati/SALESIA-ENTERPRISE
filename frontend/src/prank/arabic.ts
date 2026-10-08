import { PHRASES } from './phrases'
import { WORDS } from './words'

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt']

const SKIP = 'script, style, noscript, code, pre, [data-prank-ui]'

type Entry = { re: RegExp; to: string }

type TextRec = { original: string; current: string }

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const PHRASE_SRC: Record<string, string> = { ...PHRASES }

for (const [key, to] of Object.entries(WORDS)) {
  if (/\s/.test(key)) PHRASE_SRC[key] = to
}

const PHRASE_ENTRIES: Entry[] = Object.keys(PHRASE_SRC)
  .sort((a, b) => b.length - a.length)
  .map((key) => ({
    re: new RegExp(`(?<!\\p{L})${escapeRe(key)}(?!\\p{L})`, 'giu'),
    to: PHRASE_SRC[key],
  }))

const WORD_LOOKUP = new Map<string, string>()

for (const [key, to] of Object.entries(WORDS)) {
  if (!/\s/.test(key)) WORD_LOOKUP.set(fold(key), to)
}

const WORD_RE = /\p{L}[\p{L}\p{N}'’-]*/gu

const DIGIT_RE = /\d+/g

export function arabize(text: string): string {
  if (!text) return text
  let out = text
  for (const entry of PHRASE_ENTRIES) out = out.replace(entry.re, entry.to)
  out = out.replace(WORD_RE, (token) => WORD_LOOKUP.get(fold(token)) ?? token)
  return out.replace(DIGIT_RE, (num) => num.replace(/\d/g, (d) => AR_DIGITS[Number(d)]))
}

const TEXTS = new Map<Text, TextRec>()

const ATTS = new Map<Element, Map<string, TextRec>>()

let observer: MutationObserver | null = null

let prevLang: string | null = null

let prevDir: string | null = null

function skipped(el: Element | null): boolean {
  return el !== null && el.closest(SKIP) !== null
}

function trText(node: Text): void {
  const parent = node.parentElement
  if (parent === null || skipped(parent)) return
  const rec = TEXTS.get(node)
  const source = rec !== undefined && rec.current === node.data ? rec.original : node.data
  const next = arabize(source)
  TEXTS.set(node, { original: source, current: next })
  if (node.data !== next) node.data = next
}

function trAttr(el: Element, name: string): void {
  const value = el.getAttribute(name)
  if (value === null) return
  let map = ATTS.get(el)
  if (map === undefined) {
    map = new Map<string, TextRec>()
    ATTS.set(el, map)
  }
  const rec = map.get(name)
  const source = rec !== undefined && rec.current === value ? rec.original : value
  const next = arabize(source)
  map.set(name, { original: source, current: next })
  if (value !== next) el.setAttribute(name, next)
}

function trTree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    trText(root as Text)
    return
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return
  const el = root as Element
  if (skipped(el)) return
  for (const name of ATTRS) {
    if (el.hasAttribute(name)) trAttr(el, name)
  }
  const kids = el.childNodes
  for (let i = 0; i < kids.length; i += 1) trTree(kids[i])
}

function assertLang(): void {
  const el = document.documentElement
  if (el.lang !== 'ar') el.lang = 'ar'
  if (el.dir !== 'rtl') el.dir = 'rtl'
}

function handle(records: MutationRecord[]): void {
  for (const record of records) {
    if (record.type === 'childList') {
      record.addedNodes.forEach((node) => trTree(node))
    } else if (record.type === 'characterData') {
      const target = record.target
      if (target.nodeType === Node.TEXT_NODE) trText(target as Text)
    } else if (record.type === 'attributes') {
      const name = record.attributeName
      if (name === 'lang' || name === 'dir') {
        assertLang()
      } else if (name !== null && record.target.nodeType === Node.ELEMENT_NODE) {
        trAttr(record.target as Element, name)
      }
    }
  }
  assertLang()
}

export function startArabic(): void {
  if (observer !== null) return
  const root = document.documentElement
  prevLang = root.getAttribute('lang')
  prevDir = root.getAttribute('dir')
  TEXTS.clear()
  ATTS.clear()
  if (document.body !== null) trTree(document.body)
  assertLang()
  observer = new MutationObserver(handle)
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS, 'lang', 'dir'],
  })
}

export function stopArabic(): void {
  if (observer === null) return
  observer.disconnect()
  observer = null
  for (const [node, rec] of TEXTS) {
    if (node.isConnected && node.data !== rec.original) node.data = rec.original
  }
  TEXTS.clear()
  for (const [el, map] of ATTS) {
    if (!el.isConnected) continue
    for (const [name, rec] of map) {
      if (el.getAttribute(name) !== rec.original) el.setAttribute(name, rec.original)
    }
  }
  ATTS.clear()
  const root = document.documentElement
  if (prevLang === null) root.removeAttribute('lang')
  else root.setAttribute('lang', prevLang)
  if (prevDir === null) root.removeAttribute('dir')
  else root.setAttribute('dir', prevDir)
  prevLang = null
  prevDir = null
}
