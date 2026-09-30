import * as THREE from 'three'

// Small authored sites fit the existing valley; the main 928m trail stays authoritative.
export const COTTAGES = [
  { id: 'home', x: -83, z: 221, y: 53, yaw: -Math.PI / 2, w: 7.6, d: 6.4, h: 4.1, roof: '#676e78', wall: '#d9c6a0' },
  { id: 'scriptorium', x: -68, z: 7, y: 15, yaw: 2.2, w: 8.6, d: 7.2, h: 4.8, roof: '#647982', wall: '#d6bd8f' },
  { id: 'workshop', x: -69, z: -20, y: 15.2, yaw: 1.05, w: 10.2, d: 8.1, h: 4.3, roof: '#8b5743', wall: '#bbaf8b' },
  { id: 'growhouse', x: -34, z: 5, y: 15, yaw: -2.2, w: 7.8, d: 7.8, h: 3.9, roof: '#657c62', wall: '#d6c9a2' },
  { id: 'mill', x: -33, z: -21, y: 15, yaw: -0.85, w: 8.4, d: 7.2, h: 5.8, roof: '#696d79', wall: '#cbbb9c' },
  { id: 'store', x: -49, z: -35, y: 15, yaw: 0.1, w: 6.3, d: 5.4, h: 3.5, roof: '#9a684f', wall: '#b8b08b' },
]

export const FOREST_TRAILS: [number, number, number][][] = [
  [[-106,26.35,-108],[-94,27,-105],[-82,25.2,-109],[-78,25.6,-121],[-85,30,-137],[-98,28.47,-138]],
  [[-85,30,-137],[-84,31.1,-144],[-91,30.7,-149]],
]
export const CLEARINGS = [
  ...COTTAGES.map(b => ({ x:b.x, z:b.z, y:b.y, radius:Math.max(b.w,b.d)*0.62, blend:4 })),
  { x:-78, z:-118, y:25.5, radius:6.5, blend:5 },
  { x:-84, z:-144, y:31.1, radius:4.5, blend:3 },
]
export const regionTrailSamples = FOREST_TRAILS.map(points => new THREE.CatmullRomCurve3(
  points.map(p=>new THREE.Vector3(...p)), false, 'centripetal',
).getSpacedPoints(110))

export function nearestForestTrail(x:number,z:number) {
  let distance=Infinity, height=0
  if(x < -115 || x > -65 || z < -160 || z > -94) return {distance,height}
  for(const samples of regionTrailSamples) for(let i=0;i<samples.length-1;i++) {
    const a=samples[i],b=samples[i+1],dx=b.x-a.x,dz=b.z-a.z
    const t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1)
    const d=Math.hypot(x-a.x-dx*t,z-a.z-dz*t)
    if(d<distance){distance=d;height=THREE.MathUtils.lerp(a.y,b.y,t)}
  }
  return {distance,height}
}

export function insideCottage(x:number,z:number,margin=0.4) {
  return COTTAGES.some(b=>{
    const dx=x-b.x,dz=z-b.z,c=Math.cos(b.yaw),s=Math.sin(b.yaw)
    return Math.abs(dx*c-dz*s)<b.w/2+margin && Math.abs(dx*s+dz*c)<b.d/2+margin
  })
}

// Keep cottage approaches and working lanes clear of the broad vegetation pass.
const workingLanes = [
  [-94,219,-87,221,1.7],[-94,219,-84,212,1.5],
  [-53,24,-52,-8,2.2],[-52,-8,-58,-39,2.3],
  [-58,9,-39,-.5,2],[-52,-7,-63,-16,2],[-51,-13,-38,-17,2],
]
export function onWorkingLane(x:number,z:number) {
  return workingLanes.some(([ax,az,bx,bz,width])=>{
    const dx=bx-ax,dz=bz-az,t=THREE.MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1)
    return Math.hypot(x-ax-dx*t,z-az-dz*t)<width
  })
}
export function reservedPlanting(x:number,z:number,trees=false) {
  if(onWorkingLane(x,z))return true
  if(CLEARINGS.some(c=>Math.hypot(x-c.x,z-c.z)<c.radius+(trees?(c.z < -90 && c.z > -160 ? 8 : 4):1)))return true
  if(nearestForestTrail(x,z).distance<(trees?4:1.8))return true
  if(trees && Math.abs(z+65)<8 && Math.abs(x)<181)return true
  return !trees && Math.hypot((x-103)*0.85,z+340)<10
}
