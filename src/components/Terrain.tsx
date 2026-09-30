import SurfaceMaterial from './SurfaceMaterial'
﻿import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { buildTerrainGeometry, getGroundHeight, getSurfaceHeight, onBridge, WATERFALL_TERRAIN } from '../utils/terrain'
import { pathSamples } from '../utils/path'
function buildTrail(){
  const vertices:number[]=[],colors:number[]=[],indices:number[]=[]
  const color=new THREE.Color()
  pathSamples.forEach((p,i)=>{
    const a=pathSamples[Math.max(0,i-1)],b=pathSamples[Math.min(pathSamples.length-1,i+1)]
    const length=Math.hypot(b.x-a.x,b.z-a.z)
    const width=1.7+Math.sin(i*0.11)*0.18+Math.sin(i*0.37)*0.06
    for(let j=0;j<=12;j++){
      const side=j/6-1
      const x=p.x+(b.z-a.z)/length*width*side,z=p.z-(b.x-a.x)/length*width*side
      vertices.push(x,(onBridge(x,z)?getGroundHeight(x,z):getSurfaceHeight(x,z))+0.065,z)
      color.set(Math.abs(side)<.8?'#b9a078':'#98835a').multiplyScalar(0.97+Math.sin(i*0.79)*0.025)
      colors.push(color.r,color.g,color.b)
    }
    if(i<pathSamples.length-1)for(let j=0;j<12;j++){
      const n=i*13+j;indices.push(n,n+13,n+1,n+1,n+13,n+14)
    }
  })
  const g=new THREE.BufferGeometry()
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3))
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3))
  g.setIndex(indices);g.computeVertexNormals()
  return g
}
export default function Terrain(){
  const chunks=useMemo(()=>{
    const result=[]
    for(let x=-280;x<320;x+=80)for(let z=-562.5;z<300;z+=75){
      const segments=x===WATERFALL_TERRAIN.x&&z===WATERFALL_TERRAIN.z?WATERFALL_TERRAIN.segments:40
      result.push({x,z,geometry:buildTerrainGeometry(80,75,segments,z,x)})
    }
    return result
  },[])
  const trail=useMemo(buildTrail,[])
  useEffect(()=>()=>{chunks.forEach(c=>c.geometry.dispose());trail.dispose()},[chunks,trail])
  return <group>
    {chunks.map(c=><mesh key={c.x+','+c.z} position={[c.x,0,c.z]} geometry={c.geometry} receiveShadow>
      <SurfaceMaterial strength={0.27} />
    </mesh>)}
    <mesh geometry={trail} receiveShadow><SurfaceMaterial strength={0.32} side={THREE.DoubleSide} /></mesh>
  </group>
}

