export const LABEL_COLORS: Record<string, string> = {
  rose: '#c1495a',
  brass: '#c68b3d',
  // Lightened from #6e8b6b, which was the one fill no text color could clear:
  // 3.77 against white and 4.06 against ink. At this value ink reaches 4.94.
  sage: '#7d9a7a',
  denim: '#5c7a99',
  plum: '#7a5577',
  ochre: '#b98a2e',
}

/**
 * Ink for a label chip's own name, drawn on the matching LABEL_COLORS fill.
 * No single value works for all six: white is fine on rose (4.81), denim (4.47)
 * and plum (6.19) but collapses on the three warm/light fills — brass 2.93,
 * ochre 3.12 — which flip to the ink color instead (5.22 / 4.91). Sage needed
 * its fill lightened as well; see the note there. Keyed identically to
 * LABEL_COLORS.
 */
export const LABEL_TEXT_COLORS: Record<string, string> = {
  rose: '#ffffff',
  brass: '#2a2420',
  sage: '#2a2420',
  denim: '#ffffff',
  plum: '#ffffff',
  ochre: '#2a2420',
}
