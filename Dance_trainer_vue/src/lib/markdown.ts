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

// Source offset for a click that landed `renderedPrefix` characters into the
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
function sourceOffsetAt(source: string, blockIndex: number, renderedPrefix: string): number {
  const block = blockAt(source, blockIndex)
  if (!block) return source.length
  const wanted = renderedPrefix.replace(/\s+/g, '')
  // Clicked before the first visible character — the leading `## ` or `- ` is
  // markup, so the block's own start is the honest answer.
  if (!wanted) return block.start
  let matched = 0
  for (let i = 0; i < block.raw.length; i++) {
    const ch = block.raw.charAt(i)
    if (/\s/.test(ch)) continue
    if (ch === wanted[matched]) {
      matched++
      if (matched === wanted.length) return block.start + i + 1
    }
  }
  return block.start + block.raw.length
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
