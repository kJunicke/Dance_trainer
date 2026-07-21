import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true })

export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(marked.parse(source, { async: false }))
}

// Character offset in `source` where the nth rendered block starts, so clicking
// a paragraph in the preview can drop the caret into that same paragraph in the
// editor. Uses marked's own lexer rather than splitting on blank lines: a run of
// headings with no blank line between them is one blank-line chunk but three
// rendered elements, which would knock the mapping out of step. `space` tokens
// carry source length but render to nothing, so they advance the offset only.
export function blockSourceOffset(source: string, blockIndex: number): number {
  let offset = 0
  let rendered = 0
  for (const token of marked.lexer(source)) {
    if (token.type === 'space') {
      offset += token.raw.length
      continue
    }
    if (rendered === blockIndex) return offset
    rendered++
    offset += token.raw.length
  }
  return source.length
}

// Same rendering, but every link gets a distinct tappable-chip class plus
// target="_blank" — used where notes are read mid-practice (reference videos)
// and a plain inline link would be too easy to miss or to tap accidentally
// into an in-app navigation.
export function renderMarkdownWithLinkChips(source: string): string {
  const container = document.createElement('div')
  container.innerHTML = renderMarkdown(source)
  container.querySelectorAll('a').forEach((a) => {
    a.classList.add('md-link-chip')
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noopener noreferrer')
  })
  return container.innerHTML
}
