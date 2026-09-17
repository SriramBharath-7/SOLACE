import * as THREE from 'three'
import { PATH_CONTROL_POINTS } from '../constants'
export const pathCurve = new THREE.CatmullRomCurve3(
  PATH_CONTROL_POINTS.map(([x,y,z]) => new THREE.Vector3(x,y,z)), false, 'centripetal',
)
export const pathSamples = pathCurve.getSpacedPoints(900)
export const trailLength = pathCurve.getLength()
// Index once: terrain and vegetation query only local trail segments.
const cells = new Map<string,number[]>()
const CELL = 24
for(let i=0;i<pathSamples.length-1;i++){
  const a=pathSamples[i], b=pathSamples[i+1]
  for(let cx=Math.floor((Math.min(a.x,b.x)-18)/CELL);cx<=Math.floor((Math.max(a.x,b.x)+18)/CELL);cx++){
    for(let cz=Math.floor((Math.min(a.z,b.z)-18)/CELL);cz<=Math.floor((Math.max(a.z,b.z)+18)/CELL);cz++){
      const key=cx+','+cz, list=cells.get(key)??[]
      list.push(i); cells.set(key,list)
    }
  }
}
export function nearestPath(x:number,z:number){
  let distanceSq=Infinity,height=0,progress=0
  const candidates=cells.get(Math.floor(x/CELL)+','+Math.floor(z/CELL))??[]
  for(const i of candidates){
    const a=pathSamples[i],b=pathSamples[i+1],dx=b.x-a.x,dz=b.z-a.z
    const t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1)
    const d=(x-a.x-dx*t)**2+(z-a.z-dz*t)**2
    if(d<distanceSq){distanceSq=d;height=THREE.MathUtils.lerp(a.y,b.y,t);progress=(i+t)/(pathSamples.length-1)}
  }
  return {distance:Math.sqrt(distanceSq),height,progress}
}
export function distanceToPath(x:number,z:number){return nearestPath(x,z).distance}
export function samplePath(t:number){return pathCurve.getPointAt(THREE.MathUtils.clamp(t,0,1))}

