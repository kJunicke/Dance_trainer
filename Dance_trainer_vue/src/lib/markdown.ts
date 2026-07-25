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

// Focus the note textarea with the caret at `offset`.
//
// Nothing here scrolls, by explicit decision. The editor autosizes to its own
// scrollHeight and the note field no longer caps its height, so the textarea
// has no internal scroll left to adjust — which is why the mirror-measuring
// scrollCaretIntoView() that used to live here is gone. Focus is deliberately
// *not* `preventScroll`, so the browser's own focus-scrolling brings the field
// into view: try the default first.
//
// Known risk, accepted for now rather than solved: the browser only guarantees
// the *element* is scrolled into view, not the caret's line within it. A tall
// block autosizes past the visual viewport, so a caret near its bottom can
// still land off-screen — or behind the virtual keyboard on a phone. If that
// bites, the fix is to scroll the caret's line in the *page*, not the textarea.
export function focusAtOffset(el: HTMLTextAreaElement, offset: number): void {
  el.focus()
  el.setSelectionRange(offset, offset)
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

// Zero-width and non-breaking characters render as nothing but survive trim(),
// so a paragraph made only of them looks like an empty block that can't be got
// rid of. Notes pasted out of Confluence are full of them.
const INVISIBLE = /[\s\u00a0\u200b-\u200d\u2060\ufeff]/g

export function hasVisibleContent(text: string): boolean {
  return text.replace(INVISIBLE, '') !== ''
}

export function splitBlocks(source: string): MarkdownBlock[] {
  const out: MarkdownBlock[] = []
  let offset = 0
  // marked's own lexer, not a split on blank lines: a run of headings with no
  // blank line between them is one blank-line chunk but three rendered
  // elements, which knocks the offset mapping out of step. `space` tokens carry
  // source length but render to nothing, so they advance the offset only. A
  // token with nothing visible in it is treated the same way: it would render
  // as a blank, unremovable block with an invisible character inside.
  for (const token of marked.lexer(source)) {
    if (token.type === 'space' || !hasVisibleContent(token.raw)) {
      offset += token.raw.length
      continue
    }
    out.push({ start: offset, raw: token.raw, html: renderMarkdownWithLinkChips(token.raw) })
    offset += token.raw.length
  }
  return out
}

// The separator that has to follow `body` for it to stay its own block once
// `after` is spliced back on, given the `trailing` newlines the block already
// owned. marked keeps the blank lines *between* blocks in their own `space`
// tokens, so a block's raw usually stops at its last character and re-adding a
// separator unconditionally stacks another blank line into the gap on every
// save — hence preferring what's already there.
//
// But a single newline ends a heading or a list and not a paragraph, so
// rewriting `### Head` into plain text with the next line glued underneath
// would swallow that line into the same block. The lexer is the authority on
// which constructs self-terminate, so ask it rather than keeping a list here.
// That glued-heading case is what the escalation to '\n\n' below is for, and it
// genuinely fixes it.
//
// What it cannot fix is a block rewritten into a list item next to an existing
// list of the same marker: CommonMark dropped the old "a blank line ends a
// list" rule, so 1, 2, 5 or 10 blank lines all lex as one list and no
// separator this function can return will keep them apart. The consequence is
// that the two merge into a single lexer token, i.e. a single editable block.
// Deliberate: typing a bullet beside a list *means* joining it, it renders
// correctly, and no bytes are lost — the alternative is injecting `<!-- -->`
// separators, permanent noise in notes that are kept for years. Note also that
// this function only ever inspects what *follows* the block, so the mirror case
// — a block rewritten as a bullet with a list *above* it — isn't even detected.
// Same accepted outcome.
export function blockSeparator(body: string, after: string, trailing: string): string {
  // Nothing follows: the block ends the note, so it needs no separator at all.
  // Returning '\n' here appended one on the first no-op save of a source that
  // didn't end in a newline.
  const sep = trailing || (after.startsWith('\n') ? '' : after ? '\n\n' : '')
  if (!after) return sep
  const first = marked.lexer(body + sep + after)[0]
  return first && first.raw.length <= body.length + sep.length ? sep : '\n\n'
}

// Caret offset within `raw` for a click inside that block's rendered element.
// The caller already knows which block was hit, so there's no lexer index to
// resolve — only the walk from rendered text back to source markup.
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
