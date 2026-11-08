import { describe, expect, it } from 'vitest'
import {
  OVERSCROLL_C,
  overscrollAmount,
  rubberBandInvert,
  rubberBandOffset,
  visualScrollOffset,
} from './overscroll'

describe('rubberBandOffset', () => {
  it('returns 0 for zero pull', () => {
    expect(rubberBandOffset(0, 800)).toBe(0)
  })

  it('returns 0 when d or c is non-positive', () => {
    expect(rubberBandOffset(100, 0)).toBe(0)
    expect(rubberBandOffset(100, -10)).toBe(0)
    expect(rubberBandOffset(100, 800, 0)).toBe(0)
  })

  it('matches the hyperbolic formula', () => {
    const x = 200
    const d = 844
    const c = OVERSCROLL_C
    const expected = (1 - 1 / ((c * x) / d + 1)) * d
    expect(rubberBandOffset(x, d, c)).toBeCloseTo(expected, 10)
  })

  it('preserves sign', () => {
    const d = 800
    expect(rubberBandOffset(120, d)).toBeGreaterThan(0)
    expect(rubberBandOffset(-120, d)).toBeLessThan(0)
    expect(rubberBandOffset(-120, d)).toBeCloseTo(-rubberBandOffset(120, d), 10)
  })

  it('is compressive: |offset| < |x| for positive pull when c < 1', () => {
    const d = 844
    for (const x of [1, 40, 200, 800, 2000]) {
      const o = rubberBandOffset(x, d)
      expect(Math.abs(o)).toBeLessThan(x)
      expect(o).toBeGreaterThan(0)
    }
  })

  it('is concave: further pull yields diminishing increments', () => {
    const d = 844
    const o100 = rubberBandOffset(100, d)
    const o200 = rubberBandOffset(200, d)
    const o300 = rubberBandOffset(300, d)
    expect(o200 - o100).toBeGreaterThan(o300 - o200)
  })

  it('approaches d asymptotically', () => {
    const d = 844
    const huge = rubberBandOffset(1e9, d)
    expect(huge).toBeLessThan(d)
    expect(huge).toBeGreaterThan(d * 0.999)
  })

  it('inverts cleanly via rubberBandInvert', () => {
    const d = 844
    for (const x of [10, 80, 250, 900]) {
      const o = rubberBandOffset(x, d)
      expect(rubberBandInvert(o, d)).toBeCloseTo(x, 6)
    }
  })
})

describe('visualScrollOffset', () => {
  const min = 0
  const max = 1000
  const d = 800

  it('is identity inside bounds', () => {
    expect(visualScrollOffset(250, min, max, d, true)).toBe(250)
    expect(visualScrollOffset(250, min, max, d, false)).toBe(250)
  })

  it('uses 1:1 past edges when damping is off', () => {
    expect(visualScrollOffset(-80, min, max, d, false)).toBe(-80)
    expect(visualScrollOffset(1080, min, max, d, false)).toBe(1080)
  })

  it('rubber-bands past edges when damping is on', () => {
    const pastEnd = visualScrollOffset(1000 + 200, min, max, d, true)
    expect(pastEnd).toBeCloseTo(1000 + rubberBandOffset(200, d), 10)
    expect(pastEnd).toBeLessThan(1200)

    const pastStart = visualScrollOffset(-200, min, max, d, true)
    expect(pastStart).toBeCloseTo(-rubberBandOffset(200, d), 10)
    expect(pastStart).toBeGreaterThan(-200)
  })
})

describe('overscrollAmount', () => {
  it('reports signed excess past bounds', () => {
    expect(overscrollAmount(50, 0, 100)).toBe(0)
    expect(overscrollAmount(-20, 0, 100)).toBe(-20)
    expect(overscrollAmount(130, 0, 100)).toBe(30)
  })
})
