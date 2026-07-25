import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true })

// The board face (TaskCard) shows descriptions as a decorative preview and
// already kills clicks on them with pointer-events: none — but an <a href> is
// still a tab stop, so ~100 invisible anchors sat in the board's tab order
// reading out clipped URL fragments. Dropping href/target/rel takes them out of
// it while the link text still renders. Links stay live wherever notes are
// actually read: renderMarkdownWithLinkChips() below.
export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(marked.parse(source, { async: false }), {
    FORBID_ATTR: ['href', 'target', 'rel'],
  })
}

// Where the nth rendered block starts in `source`, and its raw text. Uses
// marked's own lexer rather than splitting on blank lines: a run of headings
// with no blank line between them is one blank-line chunk but three rendered
// elements, which would knock the mapping out of step. `space` tokens carry
// source length but render to nothing, so they advance the offset only.
function blockAt(source: string, blockIndex: number): { start: number; raw: string } | null {
  let offset = 0
  let rendered = 0
  for (const token of marked.lexer(source)) {
    if (token.type === 'space') {
      offset += token.raw.length
      continue
    }
    if (rendered === blockIndex) return { start: offset, raw: token.raw }
    rendered++
    offset += token.raw.length
  }
  return null
}

// Offset into `raw` for a click that landed `renderedPrefix` characters into the
// block's *rendered* text. Walks source and prefix together, consuming a prefix
// character on every match, so markup the reader never sees (`**`, `# `, `- `,
// a link's `](url)`) is stepped over without being counted.
//
// Whitespace is ignored on both sides rather than matched: `breaks: true` turns
// a source newline into a <br> that contributes no text, and marked's own
// pretty-printing inserts newlines between <li> elements that were never in the
// source. Comparing those directly desynchronises the walk on the first list.
//
// The walk is greedy and never backtracks, so a markup character that happens to
// equal the next visible character can consume it early — `*` in `**a*b**` and
// the like. The caret then sits a character or two off inside the right word,
// which is a far smaller miss than the block-start approximation this replaces.
function offsetInRaw(raw: string, renderedPrefix: string): number {
  const wanted = renderedPrefix.replace(/\s+/g, '')
  // Clicked before the first visible character — the leading `## ` or `- ` is
  // markup, so the block's own start is the honest answer.
  if (!wanted) return 0
  let matched = 0
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charAt(i)
    if (/\s/.test(ch)) continue
    if (ch === wanted[matched]) {
      matched++
      if (matched === wanted.length) return i + 1
    }
  }
  return raw.length
}

// Source offset for a click that landed `renderedPrefix` characters into the
// nth rendered block's text.
function sourceOffsetAt(source: string, blockIndex: number, renderedPrefix: string): number {
  const block = blockAt(source, blockIndex)
  if (!block) return source.length
  return block.start + offsetInRaw(block.raw, renderedPrefix)
}

// Chrome shipped caretPositionFromPoint only in 128; caretRangeFromPoint is the
// long-standing WebKit/Blink spelling of the same thing.
function caretPositionFromPoint(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y)
    return pos ? { node: pos.offsetNode, offset: pos.offset } : null
  }
  const range = doc.caretRangeFromPoint?.(x, y)
  return range ? { node: range.startContainer, offset: range.startOffset } : null
}

// Rendered text of `block` up to (node, offset) — the click's position expressed
// as a count of visible characters.
function textBefore(block: Node, target: Node, offset: number): string {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  let out = ''
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n === target) return out + (n.textContent ?? '').slice(0, offset)
    out += n.textContent ?? ''
  }
  // The point resolved to an element rather than a text node — clicking the
  // slack to the right of the last line. End of that block.
  return out
}

// Caret offset in the markdown source for a click at the pointer's position
// inside the rendered `body`. This is what makes the preview editable in place:
// tap a word in a month-old note and the editor opens with the caret on that
// word, instead of at the end of the source with the word to be hunted down
// again among the markup.
export function caretOffsetFromClick(body: Element, e: MouseEvent, source: string): number {
  const pos = caretPositionFromPoint(e.clientX, e.clientY)
  if (!pos || !body.contains(pos.node)) return source.length
  // Up to the top-level block: nested inline nodes (<strong>, an <a> chip, a
  // <li>) are all inside one lexer token, and it's the token index we need.
  let node: Node | null = pos.node
  while (node && node.parentNode !== body) node = node.parentNode
  if (!node) return source.length
  const blockIndex = Array.prototype.indexOf.call(body.children, node)
  if (blockIndex < 0) return source.length
  return sourceOffsetAt(source, blockIndex, textBefore(node, pos.node, pos.offset))
}

// Where the caret at `offset` sits vertically in `el`, measured with an
// off-screen mirror that wraps text exactly as the textarea does (same width,
// font metrics and tab size). Needed because Blink's setSelectionRange places
// the caret but never scrolls it into view, and v-model parks a freshly-mounted
// textarea scrolled to its bottom — so clicking near the top of a long note
// opened the editor showing the note's *end* with the caret stranded off-screen
// above. We centre the caret's line in the field instead.
function scrollCaretIntoView(el: HTMLTextAreaElement, offset: number): void {
  const s = getComputedStyle(el)
  const mirror = document.createElement('div')
  mirror.style.cssText =
    'position:absolute;top:0;left:-9999px;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:content-box'
  mirror.style.width = `${el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight)}px`
  for (const p of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'tabSize'] as const) {
    mirror.style[p] = s[p]
  }
  mirror.textContent = el.value.slice(0, offset)
  const marker = mirror.appendChild(document.createElement('span'))
  marker.textContent = '​'
  document.body.appendChild(mirror)
  const caretTop = marker.offsetTop
  mirror.remove()
  const max = el.scrollHeight - el.clientHeight
  el.scrollTop = Math.max(0, Math.min(caretTop - el.clientHeight / 2, max))
}

// Focus the note textarea with the caret at `offset` and that line centred.
// `preventScroll` stops the browser from scrolling the surrounding modal to
// reach the field — the field is already where the user just clicked; only the
// textarea's own scroll needs adjusting, which scrollCaretIntoView handles.
// Shared verbatim by both note surfaces (card modal, Practice Companion).
export function focusAtOffset(el: HTMLTextAreaElement, offset: number): void {
  el.focus({ preventScroll: true })
  el.setSelectionRange(offset, offset)
  scrollCaretIntoView(el, offset)
}

// One top-level markdown block: where its source starts, its raw source, and
// the HTML it renders to on its own. Splitting the note this way is what lets a
// single block be swapped for a textarea while every other block stays rendered
// — the reader keeps their visual anchor instead of the whole note flipping to
// raw source on every small edit.
export interface MarkdownBlock {
  start: number
  raw: string
  html: string
}

export function splitBlocks(source: string): MarkdownBlock[] {
  const out: MarkdownBlock[] = []
  let offset = 0
  // `space` tokens carry source length but render to nothing, so they advance
  // the offset only — same rule blockAt() uses to keep the mapping in step.
  for (const token of marked.lexer(source)) {
    if (token.type === 'space') {
      offset += token.raw.length
      continue
    }
    out.push({ start: offset, raw: token.raw, html: renderMarkdownWithLinkChips(token.raw) })
    offset += token.raw.length
  }
  return out
}

// Caret offset within `raw` for a click inside that block's rendered element.
// The block-scoped twin of caretOffsetFromClick(): the caller already knows
// which block was hit, so there's no block index to resolve.
export function caretOffsetInBlock(blockEl: Element, e: MouseEvent, raw: string): number {
  const pos = caretPositionFromPoint(e.clientX, e.clientY)
  if (!pos || !blockEl.contains(pos.node)) return raw.length
  return offsetInRaw(raw, textBefore(blockEl, pos.node, pos.offset))
}

// Same markdown, but links keep their href and every one gets a distinct
// tappable-chip class plus target="_blank" — used where notes are read
// mid-practice (reference videos) and a plain inline link would be too easy to
// miss or to tap accidentally into an in-app navigation.
export function renderMarkdownWithLinkChips(source: string): string {
  const container = document.createElement('div')
  container.innerHTML = DOMPurify.sanitize(marked.parse(source, { async: false }))
  container.querySelectorAll('a').forEach((a) => {
    a.classList.add('md-link-chip')
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noopener noreferrer')
  })
  return container.innerHTML
}
