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

// A heading as the lexer saw it, plus where its source lives. Only *top-level*
// headings are collected: a `#` inside a blockquote or a list item is a heading
// token too, but it hangs off a parent token whose own raw carries `> ` / `  `
// prefixes, so its offset can't be mapped back to the source by adding raw
// lengths. Sections and demotion therefore both ignore nested headings — they
// travel with whatever block owns them and their level is left alone.
interface RawHeading {
  level: number
  text: string
  start: number
  end: number
  raw: string
}

// `marked.lexer()` normalises CRLF (and lone CR) to LF *before* tokenising, so
// on a CRLF note the token `raw` lengths no longer sum to `source.length` and
// every offset derived from them drifts one byte per `\r` seen so far. Slicing
// with those offsets straddles the real boundaries — the header text bleeds
// into the extracted card and a fragment of the body is left stranded under the
// wrong heading, or dropped entirely.
//
// So the whole split/merge path works on LF text and says so: every public
// function below normalises first and returns LF. A CRLF note is rewritten to
// LF the first time it's split, which is a fix, not a loss. CRLF reaches us
// from Trello descriptions authored on Windows (`parseTrelloExport` copies
// `desc` verbatim) and survives editing, since commitEdit splices rather than
// rewrites.
function toLf(source: string): string {
  return source.replace(/\r\n|\r/g, '\n')
}

// Takes already-LF text — callers normalise via toLf() so their own slicing
// offsets agree with these.
function topLevelHeadings(source: string): RawHeading[] {
  const out: RawHeading[] = []
  let offset = 0
  // Same offset walk as splitBlocks(): every token's raw is a verbatim slice of
  // the source and their lengths sum to source.length, so accumulating them
  // gives each token's start for free.
  for (const token of marked.lexer(source)) {
    if (token.type === 'heading') {
      out.push({
        level: token.depth,
        text: token.text,
        start: offset,
        end: offset + token.raw.length,
        raw: token.raw,
      })
    }
    offset += token.raw.length
  }
  return out
}

// One heading and everything under it. `start`/`end` are source offsets, so
// `source.slice(start, end)` is the whole section including its header line and
// any blank lines trailing it (the lexer parks those in `space` tokens, which
// the walk above rolls into the *preceding* section's range — that's what keeps
// a removal from leaving its old separator behind).
//
// IMPORTANT: the ranges OVERLAP. Every heading at every level is its own
// section, in document order, and a section runs to the next heading of the
// same or higher level — so a `##` swallows the `###`s under it, and both the
// `##` and each of those `###`s appear in the list with nested ranges. The list
// is a flat menu for the user to pick one entry from; it is not a partition of
// the note, and callers must not iterate it assuming disjointness.
export interface NoteSection {
  level: number
  title: string
  start: number
  end: number
  body: string
}

// Every heading in `source` as a section. Content above the first heading is
// not a section and no split can move it.
export function noteSections(rawSource: string): NoteSection[] {
  const source = toLf(rawSource)
  const heads = topLevelHeadings(source)
  return heads.map((h, i) => {
    // The section ends where the next same-or-shallower heading begins; a
    // deeper one is part of this section, not the end of it.
    const next = heads.slice(i + 1).find((o) => o.level <= h.level)
    const end = next ? next.start : source.length
    return {
      level: h.level,
      title: h.text.trim(),
      start: h.start,
      end,
      // The header line is consumed by the caller (it becomes the card's name),
      // so the body starts after it. Leading newlines go because they were only
      // the gap under the header; trailing whitespace goes because the range
      // reaches to the next header. Leading *spaces* are kept — stripping them
      // would turn a body that opens with an indented code block into a
      // paragraph.
      body: source.slice(h.end, end).replace(/^\n+/, '').replace(/\s+$/, ''),
    }
  })
}

// Lift a section out of a note. `extracted` is the section's body with the
// header line dropped; `remaining` is the note with the whole range gone.
//
// Nothing is left behind — no stub, no back-link, no `<!-- -->` marker. That
// last one was rejected outright for blockSeparator() above and the reason is
// the same here: permanent noise in notes that are kept for years.
//
// Whitespace contract — exactly what may change, and only at the two cut edges:
//   - the text before the cut loses any trailing whitespace it had,
//   - the text after the cut loses any trailing whitespace it had,
//   - they are rejoined with blockSeparator(), i.e. a single blank line,
//   - if either side is empty the other is returned alone, so removing the only
//     section of a note with no preamble gives '' rather than '\n\n'.
// Everything between those edges is byte-identical to the source. `extracted`
// is the body slice with leading newlines and trailing whitespace removed.
export function splitSection(
  rawSource: string,
  section: NoteSection,
): { remaining: string; extracted: string } {
  // Must normalise exactly as noteSections() did, or the offsets it handed back
  // don't address this string.
  const source = toLf(rawSource)
  const before = source.slice(0, section.start).replace(/\s+$/, '')
  const after = source.slice(section.end).replace(/\s+$/, '')
  const remaining =
    before && after ? before + blockSeparator(before, after, '') + after : before || after
  return { remaining, extracted: section.body }
}

// A heading indented up to three spaces is still a heading, so the indent has
// to survive the rewrite rather than be part of the match.
const ATX_HASHES = /^([ \t]*)#{1,6}/

// `raw` rewritten to `level`, or null if it can't be rewritten and must be left
// as it is. Setext headings (`Foo\n---`) are rewritten into ATX form, because
// setext can only express levels 1 and 2 and demotion routinely needs 3+. The
// one setext case that returns null is a multi-line one, which has no ATX
// spelling at all.
function rewriteHeadingLevel(raw: string, text: string, level: number): string | null {
  if (ATX_HASHES.test(raw)) {
    return raw.replace(ATX_HASHES, (_m, indent: string) => indent + '#'.repeat(level))
  }
  if (text.includes('\n')) return null
  return '#'.repeat(level) + ' ' + text + (/\n*$/.exec(raw)?.[0] ?? '')
}

// Shift every heading by one uniform delta so the shallowest lands on
// `targetShallowest`, keeping relative nesting. `##`/`###`/`##` at target 3
// becomes `###`/`####`/`###`. A source with no headings comes back untouched.
//
// Clamped at 6, since markdown has no `#######`. Clamping is per-heading, so it
// COMPRESSES nesting rather than preserving it: `##`/`######` demoted to
// shallowest 3 gives `###`/`######`, a four-level gap squeezed to three, and
// two headings that both land past 6 pile onto 6 together — the distinction
// between them is gone for good, not recoverable by promoting back. Only
// reachable by demoting a note that is already deep.
//
// `#` characters that aren't headings are safe: the lexer hands back only
// heading tokens, so a `#` inside a fenced block, inside inline code, or
// mid-line is never even looked at.
export function demoteHeadings(rawSource: string, targetShallowest: number): string {
  const source = toLf(rawSource)
  const heads = topLevelHeadings(source)
  if (!heads.length) return source
  const delta = targetShallowest - Math.min(...heads.map((h) => h.level))
  if (delta === 0) return source
  let out = ''
  let cursor = 0
  for (const h of heads) {
    const rewritten = rewriteHeadingLevel(h.raw, h.text, clampLevel(h.level + delta))
    if (rewritten === null) continue
    out += source.slice(cursor, h.start) + rewritten
    cursor = h.end
  }
  return out + source.slice(cursor)
}

function clampLevel(level: number): number {
  return Math.min(6, Math.max(1, level))
}

// Fold a child card back into its parent: the child's title becomes a heading
// at the end of the parent's note and the child's own note follows it, demoted
// so its shallowest heading sits one level under that title. With the default
// `titleLevel` of 1 the child's headings start at `##`.
//
// A clean fold by explicit decision — no practice-history line, no metadata, no
// marker comment. These notes stay entirely hand-written.
export function mergeNote(
  parentNote: string,
  childTitle: string,
  childNote: string,
  titleLevel: number,
): string {
  const level = clampLevel(titleLevel)
  const header = '#'.repeat(level) + ' ' + childTitle.trim()
  const body = demoteHeadings(childNote, clampLevel(level + 1))
    .replace(/^\n+/, '')
    .replace(/\s+$/, '')
  const block = body ? header + '\n\n' + body : header
  // Normalised for the same reason as the rest of the path, and so a CRLF
  // parent and an LF child can't produce a note with mixed line endings.
  const parent = toLf(parentNote).replace(/\s+$/, '')
  // An empty parent gets the block on its own, with no leading blank lines.
  return parent ? parent + blockSeparator(parent, block, '') + block : block
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
