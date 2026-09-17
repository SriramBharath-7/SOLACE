import * as THREE from 'three'
import { fbm2D } from './noise'
import { nearestPath } from './path'
const smooth=THREE.MathUtils.smoothstep, mix=THREE.MathUtils.lerp
const hill=(x:number,z:number,cx:number,cz:number,rx:number,rz:number,h:number)=>
  h*Math.exp(-(((x-cx)/rx)**2)-((z-cz)/rz)**2)
export const riverX=(z:number)=>25+20*Math.sin(z*0.018)
export const riverLevel=(z:number)=>5+(300-z)*0.018+30*smooth(-z,168,180)
export const riverHalfWidth=(z:number)=>6.5+3.5*Math.exp(-(((z+142)/36)**2))+1.5*Math.sin(z*0.025)**2
export const BRIDGE_Z=-212
export const BRIDGE_X=riverX(BRIDGE_Z)
export const BRIDGE_Y=47.95
export const BRIDGE_HALF_LENGTH=14
/** Shared surface for rendering, planting, grounding and collision. */
export function getTerrainHeight(x:number,z:number):number{
  let h=8+fbm2D(x*0.015,z*0.015,3)*7
  h+=hill(x,z,-120,235,97,102,53)
  h+=hill(x,z,-265,40,77,190,128)
  h+=hill(x,z,-237,-270,85,150,150)
  h+=hill(x,z,243,45,87,190,121)
  h+=hill(x,z,-135,-148,74,95,26)
  h+=hill(x,z,-25,-310,98,114,57)
  h+=hill(x,z,136,-335,99,122,149)
  h+=hill(x,z,-60,-530,230,85,180)
  h+=fbm2D(x*0.066,z*0.066,3)*(1.1+smooth(h,32,130)*6)
  const village=1-smooth(Math.hypot((x+52)*0.9,z+8),22,44)
  h=mix(h,15+fbm2D(x*0.06,z*0.06,2)*0.2,village)
  const summit=1-smooth(Math.hypot(x-105,z+340),9,23)
  h=mix(h,148+fbm2D(x*0.1,z*0.1,2)*0.25,summit)
  const trail=nearestPath(x,z)
  h=mix(h,trail.height,1-smooth(trail.distance,2.8,13))
  // River after trail grading keeps the gorge open beneath the bridge.
  if(z>-320){
    const width=riverHalfWidth(z)
    const bank=1-smooth(Math.abs(x-riverX(z)),width-1,width+13)
    h=mix(h,riverLevel(z)-1.9,bank)
  }
  // Graded abutments meet both deck ends while leaving the river channel open.
  const bridgeDistance=Math.abs(x-BRIDGE_X)
  const abutment=(1-smooth(Math.abs(z-BRIDGE_Z),2.35,7))
    *smooth(bridgeDistance,BRIDGE_HALF_LENGTH-4,BRIDGE_HALF_LENGTH-0.5)
    *(1-smooth(bridgeDistance,BRIDGE_HALF_LENGTH+4,BRIDGE_HALF_LENGTH+16))
  h=mix(h,BRIDGE_Y,abutment)
  return h
}
export function getTerrainSlope(x:number,z:number){
  return Math.hypot(getTerrainHeight(x+0.7,z)-getTerrainHeight(x-0.7,z),
    getTerrainHeight(x,z+0.7)-getTerrainHeight(x,z-0.7))/1.4
}
export function onBridge(x:number,z:number){
  return Math.abs(x-BRIDGE_X)<BRIDGE_HALF_LENGTH&&Math.abs(z-BRIDGE_Z)<2.35
}
export function getGroundHeight(x:number,z:number){
  return onBridge(x,z)?Math.max(BRIDGE_Y,getTerrainHeight(x,z)):getTerrainHeight(x,z)
}
export function isWalkable(x:number,z:number){
  if(onBridge(x,z))return true
  if(z>-320&&Math.abs(x-riverX(z))<riverHalfWidth(z)+0.7)return false
  return getTerrainSlope(x,z)<0.95
}
const grass=new THREE.Color('#557638'),meadow=new THREE.Color('#819a48')
const rock=new THREE.Color('#7a8176'),stone=new THREE.Color('#a1a18b'),dirt=new THREE.Color('#ad9366')
export function buildTerrainGeometry(width:number,depth:number,segments:number,zOffset=0,xOffset=0){
  const geometry=new THREE.PlaneGeometry(width,depth,segments,segments)
  geometry.rotateX(-Math.PI/2)
  const pos=geometry.attributes.position as THREE.BufferAttribute
  const colors=new Float32Array(pos.count*3),normals=new Float32Array(pos.count*3)
  const color=new THREE.Color(),normal=new THREE.Vector3()
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i)+xOffset,z=pos.getZ(i)+zOffset,h=getTerrainHeight(x,z)
    pos.setY(i,h)
    const variation=fbm2D(x*0.036,z*0.036,3)*0.5+0.5
    color.copy(grass).lerp(meadow,variation)
    const slope=getTerrainSlope(x,z)
    color.lerp(rock,smooth(slope,0.55,1.5)*0.94)
    color.lerp(stone,smooth(h,100,190)*(0.2+smooth(slope,0.4,1.3)*0.65))
    color.lerp(dirt,(1-smooth(nearestPath(x,z).distance,1.5,3.8))*0.65)
    if(z>-320)color.lerp(stone,(1-smooth(Math.abs(x-riverX(z)),riverHalfWidth(z),riverHalfWidth(z)+4))*0.7)
    color.multiplyScalar(0.94+fbm2D(x*0.27,z*0.27,2)*0.06).toArray(colors,i*3)
    normal.set(getTerrainHeight(x-0.35,z)-getTerrainHeight(x+0.35,z),0.7,
      getTerrainHeight(x,z-0.35)-getTerrainHeight(x,z+0.35)).normalize().toArray(normals,i*3)
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3))
  geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3))
  return geometry
}

