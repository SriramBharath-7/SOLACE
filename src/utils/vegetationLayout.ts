import { mulberry32 } from './noise'
import { distanceToPath, samplePath } from './path'
import { getTerrainHeight, getTerrainSlope, riverX, riverLevel, riverHalfWidth } from './terrain'
import { WORLD } from '../constants'

export interface Placement {
  position: [number, number, number]
  rotationY: number
  scale: number
}

export type LayoutKey =
  | 'pineTall' | 'pineRound' | 'pineSmall' | 'oak'
  | 'rockLarge' | 'rockSmall' | 'rockSmallFlat'
  | 'flowerPurple' | 'flowerRed' | 'flowerYellow'
  | 'bushSmall' | 'bushDetailed' | 'bushLarge'
  | 'grassLarge' | 'grassLeafsLarge'

// Each grove belongs to a particular shoulder, bank or hollow. The gaps are
// as deliberate as the trees: Origin's vista, the Craft clearing, river and
// summit stay open. Radii are metres, rather than a world-wide noise scatter.
const GROVES = [
  [-145, 238, 35, 42, 92], [-54, 236, 29, 35, 68],
  [-156, 171, 36, 42, 105], [-21, 171, 27, 38, 68],
  [-128, 89, 32, 47, 98], [-12, 76, 22, 36, 60],
  [-112, -10, 26, 32, 68], [-10, -29, 24, 35, 66],
  [-168, -44, 35, 47, 94],
  [-127, -117, 47, 53, 185], [-73, -139, 36, 51, 150],
  [-145, -191, 38, 41, 105], [-26, -156, 23, 32, 64],
  [77, 94, 32, 63, 130], [99, -42, 44, 70, 160],
  [81, -148, 34, 49, 125],
  [-207, 6, 49, 172, 165], [-223, -217, 44, 108, 115],
  [216, 74, 46, 164, 155],
  [157, -195, 37, 31, 84], [209, -267, 33, 43, 82],
  [-4, -256, 51, 37, 104], [44, -299, 34, 43, 78],
  [-84, -327, 54, 33, 96],
  [-132, -403, 64, 38, 104], [24, -447, 67, 48, 123],
  [237, -415, 36, 55, 94],
] as const

export function buildVegetationLayout(seed = 1337): Record<LayoutKey, Placement[]> {
  const rng = mulberry32(seed)
  const layout: Record<LayoutKey, Placement[]> = {
    pineTall: [], pineRound: [], pineSmall: [], oak: [],
    rockLarge: [], rockSmall: [], rockSmallFlat: [],
    flowerPurple: [], flowerRed: [], flowerYellow: [],
    bushSmall: [], bushDetailed: [], bushLarge: [], grassLarge: [], grassLeafsLarge: [],
  }
  const treeCells = new Map<string, [number, number][]>()

  function suitable(x: number, z: number, pathClearance: number, maxSlope = 0.78) {
    if (Math.abs(x) > WORLD.halfWidth - 16 || z < WORLD.endZ + 20 || z > WORLD.startZ - 8) return false
    if (distanceToPath(x, z) < pathClearance) return false
    if (Math.hypot(x + 52, z + 8) < 23) return false
    if (z > -320 && Math.abs(x - riverX(z)) < riverHalfWidth(z) + 2) return false
    const height = getTerrainHeight(x, z)
    if (z > -320 && Math.abs(x - riverX(z)) < riverHalfWidth(z) + 11 && height < riverLevel(z) + 0.6) return false
    return getTerrainSlope(x, z) < maxSlope
  }

  function add(key: LayoutKey, x: number, z: number, scale: number, burial = 0.04) {
    layout[key].push({ position: [x, getTerrainHeight(x, z) - burial, z], rotationY: rng() * Math.PI * 2, scale })
  }

  function addTree(key: LayoutKey, x: number, z: number, scale: number) {
    if (!suitable(x, z, 5.5)) return
    // A broad opening from the first overlook toward the far mountain.
    if (z > 107 && z < 232 && Math.abs(x - (-94 + (220 - z) * 0.355)) < 19) return
    if (Math.hypot(x - 105, z + 340) < 38) return
    const height = getTerrainHeight(x, z)
    if (height > 130) return
    const cellX = Math.floor(x / 5)
    const cellZ = Math.floor(z / 5)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (treeCells.get(`${cellX + dx},${cellZ + dz}`)?.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 4.4)) return
      }
    }
    const cell = `${cellX},${cellZ}`
    const occupants = treeCells.get(cell) ?? []
    occupants.push([x, z])
    treeCells.set(cell, occupants)
    add(key, x, z, scale * (height > 85 ? 0.72 : 1), 0.12)
  }

  // First-view framing specimens. The journey remains visible between them.
  addTree('oak', -113, 219, 10.3)
  addTree('oak', -120, 230, 12.4)
  addTree('pineTall', -70, 236, 9.3)
  addTree('pineRound', -66, 219, 8.3)
  for (const [cx, cz, rx, rz, count] of GROVES) {
    for (let i = 0; i < count * 3; i++) {
      const angle = rng() * Math.PI * 2
      const radius = Math.sqrt(rng())
      const x = cx + Math.cos(angle) * radius * rx
      const z = cz + Math.sin(angle) * radius * rz
      const species = rng()
      const key = z > -70 && species < 0.34 ? 'oak'
        : species < 0.59 ? 'pineTall' : species < 0.85 ? 'pineRound' : 'pineSmall'
      addTree(key, x, z, key === 'pineTall' ? 6.5 + rng() * 4.7 : 6.3 + rng() * 5)
    }
  }

  // Low planting follows the walked route, with generous passing room.
  for (let i = 0; i < 11000; i++) {
    const t = rng()
    const center = samplePath(t)
    const ahead = samplePath(Math.min(1, t + 0.002))
    const heading = Math.atan2(ahead.z - center.z, ahead.x - center.x)
    const offset = (rng() < 0.5 ? -1 : 1) * (3.2 + rng() * 20)
    const x = center.x - Math.sin(heading) * offset + (rng() - 0.5) * 3
    const z = center.z + Math.cos(heading) * offset + (rng() - 0.5) * 3
    if (!suitable(x, z, 3.1, 0.7)) continue
    const y = getTerrainHeight(x, z)
    const roll = rng()
    if (roll < 0.55) add('grassLarge', x, z, 1.1 + rng() * 1.5)
    else if (roll < 0.73) add('grassLeafsLarge', x, z, 1.8 + rng() * 2)
    else if (roll < 0.88 && y < 110) add(rng() < 0.5 ? 'bushDetailed' : 'bushSmall', x, z, 2.2 + rng() * 2.3)
    else if (y < 85 && z > -170) add(rng() < 0.6 ? 'flowerPurple' : rng() < 0.65 ? 'flowerYellow' : 'flowerRed', x, z, 1.1 + rng() * 1.2)
    else add('rockSmall', x, z, 2 + rng() * 4, 0.2)
  }

  // Irregular meadow flower drifts and bank undergrowth, not uniform confetti.
  for (const [cx, cz] of [[-105, 207], [-83, 215], [-105, 181], [-120, 147], [-83, 98], [-47, 64], [-78, 15], [-94, -82], [-67, -157]]) {
    for (let i = 0; i < 220; i++) {
      const angle = rng() * Math.PI * 2
      const radius = Math.sqrt(rng()) * 13
      const x = cx + Math.cos(angle) * radius
      const z = cz + Math.sin(angle) * radius * 0.7
      if (!suitable(x, z, 3.1)) continue
      add(i % 4 === 0 ? 'flowerPurple' : i % 4 === 1 ? 'flowerYellow' : 'grassLarge', x, z, 1.4 + rng() * 1.4)
    }
  }

  for (const [cx, cz, rx, rz] of GROVES) {
    for (let i = 0; i < 65; i++) {
      const angle = rng() * Math.PI * 2
      const radius = Math.sqrt(rng())
      const x = cx + Math.cos(angle) * radius * rx
      const z = cz + Math.sin(angle) * radius * rz
      if (!suitable(x, z, 4.5, 0.9)) continue
      const rock = i % 5 === 0
      add(rock ? 'rockLarge' : i % 3 === 0 ? 'bushLarge' : 'bushDetailed', x, z, rock ? 5 + rng() * 10 : 3 + rng() * 4, rock ? 0.7 : 0.1)
    }
  }

  // One readable silhouette reserves the final destination without building
  // its future scene. No other tree competes with it inside the summit crown.
  add('oak', 109, -347, 10.2, 0.12)
  return layout
}
