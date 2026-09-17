// Lightweight, dependency-free deterministic noise. SOLACE only needs gentle
// rolling variation for terrain + natural-looking scatter for vegetation, so
// a full simplex-noise dependency would be overkill for Phase 1.

/** Deterministic PRNG (mulberry32). Same seed -> same sequence every load,
 * so vegetation placement is stable between renders/sessions. */
export function mulberry32(seed: number) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123
  return s - Math.floor(s)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function fade(t: number) {
  return t * t * (3 - 2 * t)
}

/** Smooth 2D value noise in roughly [-1, 1]. */
export function valueNoise2D(x: number, y: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = fade(x - xi)
  const yf = fade(y - yi)

  const a = hash(xi, yi)
  const b = hash(xi + 1, yi)
  const c = hash(xi, yi + 1)
  const d = hash(xi + 1, yi + 1)

  const top = lerp(a, b, xf)
  const bottom = lerp(c, d, xf)
  return lerp(top, bottom, yf) * 2 - 1
}

/** Fractal (multi-octave) noise for more natural rolling terrain. */
export function fbm2D(x: number, y: number, octaves = 4): number {
  let total = 0
  let amplitude = 1
  let frequency = 1
  let maxValue = 0
  for (let i = 0; i < octaves; i++) {
    total += valueNoise2D(x * frequency, y * frequency) * amplitude
    maxValue += amplitude
    amplitude *= 0.5
    frequency *= 2
  }
  return total / maxValue
}
