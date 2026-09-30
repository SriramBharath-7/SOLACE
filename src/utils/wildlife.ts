import * as THREE from 'three'
import { getSurfaceHeight, getTerrainSlope, isWalkable, riverHalfWidth, riverLevel, riverX } from './terrain'
import { isBlocked, moveHitsSolid } from './collision'

// Measured full GLB heights, including ears/antlers/wings. The explorer is 1.04m.
export const WILDLIFE_SPECIES = {
  cow: { rawHeight: 1.61238, height: .9, radius: .62, speed: .22 },
  bunny: { rawHeight: 2.01004, height: .28, radius: .15, speed: .16 },
  cat: { rawHeight: 1.70999, height: .28, radius: .19, speed: .18 },
  chick: { rawHeight: 1.59425, height: .18, radius: .14, speed: .12 },
  deer: { rawHeight: 1.99279, height: 1.02, radius: .6, speed: .25 },
  fox: { rawHeight: 1.68632, height: .4, radius: .32, speed: .2 },
  beaver: { rawHeight: 1.50125, height: .34, radius: .26, speed: .14 },
  bee: { rawHeight: 2.02383, height: .09, radius: .04, speed: 0 },
} as const
export type WildlifeSpecies = keyof typeof WILDLIFE_SPECIES
export const WILDLIFE_SITES: { species: WildlifeSpecies; x: number; z: number; range: number }[] = [
  { species: 'cow', x: -101, z: 211, range: 3 },
  { species: 'bunny', x: -91, z: 214, range: 2 },
  { species: 'cow', x: -112, z: 177, range: 3 },
  { species: 'bunny', x: -91, z: 101, range: 2.5 },
  { species: 'cat', x: -56, z: 4, range: 2.5 },
  { species: 'chick', x: -46, z: 7, range: 2 },
  { species: 'deer', x: -96, z: -121, range: 3 },
  { species: 'deer', x: -103, z: -126, range: 3 },
  { species: 'fox', x: -88, z: -151, range: 2.5 },
  { species: 'beaver', x: 24, z: -118, range: 2 },
]
// Existing flower gardens in HeroDetails; each bee stays inside its flower bed.
export const BEE_GARDENS = [
  [-87, 215], [-88, 225], [-105, 207], [-83, 98],
  [-74, 11], [-29, -14], [-81, -122], [-89, -147],
] as const

export function animalCanStand(x: number, z: number, species: WildlifeSpecies) {
  const { radius, height } = WILDLIFE_SPECIES[species]
  const y = getSurfaceHeight(x, z)
  if (!isWalkable(x, z) || getTerrainSlope(x, z) > .4) return false
  if (z > -320 && (Math.abs(x - riverX(z)) < riverHalfWidth(z) + radius + 1.1 || y < riverLevel(z) + .15)) return false
  return !isBlocked(x, z, y + .03, radius, height)
}

export function animalGroundPoint(x: number, z: number) {
  return new THREE.Vector3(x, getSurfaceHeight(x, z) + .015, z)
}

/** Sample the complete short route once, including terrain and narrow fences. */
export function animalRoute(from: THREE.Vector3, x: number, z: number, species: WildlifeSpecies) {
  const steps = Math.ceil(Math.hypot(x - from.x, z - from.z) / .2)
  const route = [from.clone()]
  const { radius, height } = WILDLIFE_SPECIES[species]
  for (let i = 1; i <= steps; i++) {
    const px = THREE.MathUtils.lerp(from.x, x, i / steps), pz = THREE.MathUtils.lerp(from.z, z, i / steps)
    if (!animalCanStand(px, pz, species)) return null
    const point = animalGroundPoint(px, pz), previous = route[route.length - 1]
    if (Math.abs(point.y - previous.y) > .14 || moveHitsSolid(previous.x, previous.z, px, pz, Math.min(previous.y, point.y), radius, height)) return null
    route.push(point)
  }
  return route
}
