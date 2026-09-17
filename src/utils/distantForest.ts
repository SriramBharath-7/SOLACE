import { mulberry32, fbm2D } from './noise'
import { getTerrainHeight } from './terrain'
import type { Placement } from './vegetationLayout'

interface ForestBeltOptions {
  count: number
  xRange: [number, number]
  zRange: [number, number]
  clearLaneHalfWidth: number // keep a gap open down the middle so the valley/stream sightline still reads
  scaleRange: [number, number]
  seed: number
}

/** A loose, clumped scatter used purely as background "forest mass" — no
 * path/stream awareness needed since it sits well beyond the playable slice.
 * Kept as one shared helper so the belt reads as compositionally consistent
 * with the nearer, path-aware vegetation (same clustering technique). */
export function buildForestBelt(opts: ForestBeltOptions): Placement[] {
  const rng = mulberry32(opts.seed)
  const list: Placement[] = []
  let attempts = 0
  while (list.length < opts.count && attempts < opts.count * 20) {
    attempts++
    const x = opts.xRange[0] + rng() * (opts.xRange[1] - opts.xRange[0])
    const z = opts.zRange[0] + rng() * (opts.zRange[1] - opts.zRange[0])
    if (Math.abs(x) < opts.clearLaneHalfWidth) continue

    const clusterField = (fbm2D(x * 0.06, z * 0.08, 2) + 1) * 0.5
    if (clusterField < 0.38 && rng() > 0.2) continue

    const y = getTerrainHeight(x, z)
    const scale = opts.scaleRange[0] + rng() * (opts.scaleRange[1] - opts.scaleRange[0])
    list.push({ position: [x, y, z], rotationY: rng() * Math.PI * 2, scale })
  }
  return list
}
