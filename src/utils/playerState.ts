import * as THREE from 'three'
import { getGroundHeight } from './terrain'

// Development-only arrival points make each long-distance vista reviewable.
const reviewSpawns: Record<string, [number, number, number]> = {
  craft: [-52, -8, -0.3], curiosity: [-100, -135, -0.6],
  crossing: [22, -212, -Math.PI / 2], horizon: [105, -340, 2.85],
  home: [-94, 220, -Math.PI / 2],
  research: [-82, -113, -0.9], hidden: [-89, -143, -1.6],
  falls: [4, -148, -0.65], rail: [-63, -45, -0.35],
  fallsupper: [48, -192, 2.2], fallsback: [17, -199, -2.4],
  meadow: [-99, 218, 0.2], animalscraft: [-54, 9, 0],
  animalsforest: [-96, -113, 0], riverbank: [20, -113, -0.7],
}
const review = import.meta.env.DEV && typeof window !== 'undefined'
  ? reviewSpawns[new URLSearchParams(window.location.search).get('vista') ?? ''] : undefined
const [x, z, yaw] = review ?? [-94, 220, -0.25]
export const playerState={
  position:new THREE.Vector3(x,getGroundHeight(x,z),z),
  heading:yaw, speed:0, hasMoved:false, cameraAzimuth:yaw,
}

