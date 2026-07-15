/**
 * Pure gesture math shared by WeekStrip's swipe and the Agenda content-area
 * day-swipe extension — kept dependency-free so it's unit-testable without
 * touch events or a DOM.
 */

export const DECIDE_THRESHOLD_PX = 8;
export const COMMIT_THRESHOLD_PX = 50;
export const SNAP_MS = 380;

/**
 * Decides whether an in-progress drag should be treated as a horizontal
 * swipe, a vertical scroll, or is still undecided (hasn't crossed either
 * axis's threshold yet).
 */
export function decideSwipeAxis(dx, dy, decideThreshold = DECIDE_THRESHOLD_PX) {
  if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > decideThreshold) return 'vertical';
  if (Math.abs(dx) > decideThreshold) return 'horizontal';
  return null;
}

/**
 * Given the net horizontal drag distance at release, decides whether it
 * clears the commit threshold and which direction it resolves to.
 * delta: -1 = previous (dragged right), +1 = next (dragged left).
 */
export function resolveSwipeCommit(dx, commitThreshold = COMMIT_THRESHOLD_PX) {
  if (Math.abs(dx) <= commitThreshold) return { committed: false, delta: 0 };
  return { committed: true, delta: dx < 0 ? 1 : -1 };
}
