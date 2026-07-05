import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true })

export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(marked.parse(source, { async: false }))
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
