import * as THREE from 'three'
import { getGroundHeight } from './terrain'

// Development-only arrival points make each long-distance vista reviewable.
const reviewSpawns: Record<string, [number, number, number]> = {
  craft: [-52, -8, -0.3], curiosity: [-100, -135, -0.6],
  crossing: [22, -212, -Math.PI / 2], horizon: [105, -340, 2.85],
}
const review = import.meta.env.DEV && typeof window !== 'undefined'
  ? reviewSpawns[new URLSearchParams(window.location.search).get('vista') ?? ''] : undefined
const [x, z, yaw] = review ?? [-94, 220, -0.25]
export const playerState={
  position:new THREE.Vector3(x,getGroundHeight(x,z),z),
  heading:yaw, speed:0, hasMoved:false, cameraAzimuth:yaw,
}

