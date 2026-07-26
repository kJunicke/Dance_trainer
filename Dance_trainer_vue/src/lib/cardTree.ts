// Card→card parent-link helpers. `cards.parent_id` (see the 20260726102400
// migration) lets one card be "part of" another, one parent, arbitrary depth,
// same board only. `name` on every card stays the leaf only ("Prep", never
// "OFS - Prep") — the ancestor chain is derived here at render time instead,
// so renaming a parent costs zero DB writes and can never clobber a
// hand-edited child name.
//
// Pure and dependency-free (no Vue/Pinia/IO) so it can be unit-tested and
// reused from stores, components, and search alike. Deliberately structural
// rather than importing `Card` from boardStore: any object with `id`, `name`,
// `parent_id` works, including boardStore's `Card` once that field lands.
export interface CardNode {
  id: number
  name: string
  parent_id: number | null
}

// Every function below re-scans the input array rather than requiring a
// prepared index. A board has a few hundred cards at most, so an O(n) scan
// per call is not worth the complexity of a cached id→card / parent→children
// map that callers would have to remember to rebuild after every edit.

/**
 * Direct children of `cardId`, in the order they appear in `cards`. The
 * store keeps `cards` sorted by `position`, so callers get position order
 * for free — this function does no sorting of its own.
 */
export function childrenOf(cards: CardNode[], cardId: number): CardNode[] {
  return cards.filter((c) => c.parent_id === cardId)
}

/**
 * The chain from the family root down to `cardId`'s immediate parent,
 * root-first. Excludes `cardId` itself. Empty for a top-level card.
 *
 * Cycle guard: walks upward via `parent_id`, tracking visited ids. A cycle
 * (bad import, hand-edited row) makes the walk stop the moment it would
 * revisit a node, returning the partial chain collected so far rather than
 * looping — a wrong-but-finite answer beats a hung UI.
 */
export function ancestorsOf(cards: CardNode[], cardId: number): CardNode[] {
  const byId = new Map(cards.map((c) => [c.id, c]))
  const chain: CardNode[] = []
  const visited = new Set<number>([cardId])
  let current = byId.get(cardId)
  while (current && current.parent_id !== null) {
    if (visited.has(current.parent_id)) break
    const parent = byId.get(current.parent_id)
    if (!parent) break // dangling parent_id (mid-load, filtered fetch)
    visited.add(parent.id)
    chain.unshift(parent)
    current = parent
  }
  return chain
}

/**
 * Every descendant of `cardId` at any depth, excluding `cardId` itself.
 * This is what "Part of…" / "Add existing card as part" pickers subtract
 * from their candidate list, so a card (or its own descendant) can never be
 * chosen as its own parent.
 *
 * Cycle guard: breadth-first walk downward from `cardId`, tracking visited
 * ids so a cycle among descendants can't requeue the same node forever. On
 * hitting an already-visited id the walk simply skips it and continues,
 * still terminating in O(n).
 */
export function descendantIdsOf(cards: CardNode[], cardId: number): Set<number> {
  const visited = new Set<number>([cardId])
  const queue = [cardId]
  while (queue.length > 0) {
    const id = queue.shift()!
    for (const child of childrenOf(cards, id)) {
      if (visited.has(child.id)) continue
      visited.add(child.id)
      queue.push(child.id)
    }
  }
  visited.delete(cardId)
  return visited
}

/**
 * The topmost ancestor of `cardId`, or `cardId`'s own card when it has no
 * parent. Relies on `ancestorsOf`'s cycle guard, so a cycled family resolves
 * to the outermost node the upward walk could safely reach.
 */
export function familyRootOf(cards: CardNode[], cardId: number): CardNode | undefined {
  const ancestors = ancestorsOf(cards, cardId)
  if (ancestors.length > 0) return ancestors[0]
  return cards.find((c) => c.id === cardId)
}

/**
 * The display chain for `cardId`, e.g. "One Footed Spins › Prep › Free leg".
 * Board search uses this so typing a parent's name finds its parts too.
 */
export function composedName(cards: CardNode[], cardId: number, separator = ' › '): string {
  const card = cards.find((c) => c.id === cardId)
  if (!card) return ''
  const names = [...ancestorsOf(cards, cardId).map((c) => c.name), card.name]
  return names.join(separator)
}

/**
 * Would setting `cardId`'s parent to `newParentId` create a cycle? True when
 * `newParentId` is `cardId` itself or one of its descendants. Belt-and-braces
 * guard the store's write action calls before persisting a re-parent, on top
 * of pickers already filtering `descendantIdsOf` out of their candidates.
 */
export function wouldCycle(
  cards: CardNode[],
  cardId: number,
  newParentId: number | null,
): boolean {
  if (newParentId === null) return false
  if (newParentId === cardId) return true
  return descendantIdsOf(cards, cardId).has(newParentId)
}
