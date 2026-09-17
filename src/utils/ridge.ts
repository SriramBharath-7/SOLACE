import * as THREE from 'three'
import { fbm2D, mulberry32 } from './noise'

/** A deep folded range with a wandering spine and overlapping summits.
 * Its skirt disappears below the playable terrain; there are no skyline cards. */
export function buildRidgeGeometry(
  width: number, segments: number, baseHeight: number, amplitude: number,
  seed: number, depth = 460,
): THREE.BufferGeometry {
  const random = mulberry32(seed)
  const rows = 32
  const summits = Array.from({ length: 9 }, (_, i) => ({
    x: ((i + 0.2 + random() * 0.6) / 9 - 0.5) * width,
    height: amplitude * (0.45 + random() * 0.85),
    spread: width * (0.025 + random() * 0.06),
    lean: (random() - 0.5) * 0.35,
  }))
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const meadow = new THREE.Color('#687b68')
  const stone = new THREE.Color('#879398')
  const crest = new THREE.Color('#b9b5a2')
  const color = new THREE.Color()

  for (let row = 0; row <= rows; row++) {
    const t = row / rows
    for (let col = 0; col <= segments; col++) {
      const x = (col / segments - 0.5) * width
      const spine = Math.sin(x * 0.005 + seed) * depth * 0.12
        + Math.sin(x * 0.013 - seed) * depth * 0.055
      const z = (t - 0.5) * depth + spine
      const folded = fbm2D(x * 0.009 + seed, z * 0.014, 3)
      const section = Math.pow(Math.max(0, Math.sin(t * Math.PI)), 1.9)
      let summit = 0
      for (const peak of summits) {
        const distance = (x - peak.x - (t - 0.5) * width * peak.lean) / peak.spread
        summit += peak.height * Math.exp(-distance * distance * 0.8)
      }
      // Long diagonal ribs split the smooth dome into broad rocky faces.
      const ribs = Math.abs(Math.sin(x * 0.026 + z * 0.034 + folded * 2.7))
      const height = -32 + section * (baseHeight + summit + folded * amplitude * 0.55 - ribs * amplitude * 0.18)
      const endFade = Math.min(1, Math.min(col / segments, 1 - col / segments) * 12)
      const y = -32 + (height + 32) * endFade
      positions.push(x, y, z)
      color.copy(meadow).lerp(stone, THREE.MathUtils.smoothstep(y, 30, baseHeight * 0.75))
      color.lerp(crest, THREE.MathUtils.smoothstep(y, baseHeight * 1.02, baseHeight + amplitude * 1.4) * 0.65)
      color.multiplyScalar(0.93 + folded * 0.16 + ribs * 0.04)
      colors.push(color.r, color.g, color.b)
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < segments; col++) {
      const a = row * (segments + 1) + col
      const b = a + segments + 1
      // Alternate diagonals to avoid a repeated fan in the faceted faces.
      if ((row + col) % 2) indices.push(a, b, a + 1, a + 1, b, b + 1)
      else indices.push(a, b, b + 1, a, b + 1, a + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

