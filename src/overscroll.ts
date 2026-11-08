/** Rubber-band constant used by iOS-style overscroll. */
export const OVERSCROLL_C = 0.55

/**
 * iOS-style hyperbolic rubber-band mapping (UIScrollView / WebKit form):
 *
 *   offset = (1 - 1 / (c * x / d + 1)) * d
 *
 * With 0 < c < 1 this is compressive (|offset| < |x|). Note: writing the
 * inner term as `x / (c * d)` instead of `c * x / d` inverts the role of c
 * and amplifies small pulls when c = 0.55 — we keep the resisting form so
 * the compare demo matches “one resists”.
 *
 * @param x Excess finger pull past the edge (same units as d), may be signed.
 * @param d Viewport length along the scroll axis (e.g. screen height).
 * @param c Dimensionless constant (default 0.55).
 */
export function rubberBandOffset(x: number, d: number, c: number = OVERSCROLL_C): number {
  if (x === 0) return 0
  if (!(d > 0) || !(c > 0)) return 0
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const offset = (1 - 1 / ((c * ax) / d + 1)) * d
  return sign * offset
}

/**
 * Inverse of {@link rubberBandOffset}: recover finger pull from a visual offset.
 * x = (d / c) * (o / (d - o))
 */
export function rubberBandInvert(offset: number, d: number, c: number = OVERSCROLL_C): number {
  if (offset === 0) return 0
  if (!(d > 0) || !(c > 0)) return 0
  const sign = offset < 0 ? -1 : 1
  const o = Math.abs(offset)
  if (o >= d) return sign * d * 20
  return sign * (d / c) * (o / (d - o))
}

/**
 * Map an unconstrained (1:1) scroll position to a visual position.
 * Inside [min, max] the mapping is identity; past the edges it rubber-bands when
 * `damping` is true, otherwise it stays 1:1 (`offset = x` past the edge).
 */
export function visualScrollOffset(
  position: number,
  min: number,
  max: number,
  d: number,
  damping: boolean,
  c: number = OVERSCROLL_C,
): number {
  if (position < min) {
    const excess = min - position
    return damping ? min - rubberBandOffset(excess, d, c) : position
  }
  if (position > max) {
    const excess = position - max
    return damping ? max + rubberBandOffset(excess, d, c) : position
  }
  return position
}

/** How far `visual` sits past [min, max] (negative = past start, positive = past end). */
export function overscrollAmount(visual: number, min: number, max: number): number {
  if (visual < min) return visual - min
  if (visual > max) return visual - max
  return 0
}
