import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { buildTerrainGeometry, getGroundHeight } from '../utils/terrain'
import { pathSamples } from '../utils/path'
function buildTrail(){
  const vertices:number[]=[],colors:number[]=[],indices:number[]=[]
  const color=new THREE.Color()
  pathSamples.forEach((p,i)=>{
    const a=pathSamples[Math.max(0,i-1)],b=pathSamples[Math.min(pathSamples.length-1,i+1)]
    const length=Math.hypot(b.x-a.x,b.z-a.z)
    const width=1.7+Math.sin(i*0.11)*0.18+Math.sin(i*0.37)*0.06
    for(const side of [-1,0,1]){
      const x=p.x+(b.z-a.z)/length*width*side,z=p.z-(b.x-a.x)/length*width*side
      vertices.push(x,getGroundHeight(x,z)+0.075,z)
      color.set(side===0?'#b9a078':'#98835a').multiplyScalar(0.97+Math.sin(i*0.79)*0.025)
      colors.push(color.r,color.g,color.b)
    }
    if(i<pathSamples.length-1)for(let j=0;j<2;j++){
      const n=i*3+j;indices.push(n,n+3,n+1,n+1,n+3,n+4)
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
      result.push({x,z,geometry:buildTerrainGeometry(80,75,40,z,x)})
    }
    return result
  },[])
  const trail=useMemo(buildTrail,[])
  useEffect(()=>()=>{chunks.forEach(c=>c.geometry.dispose());trail.dispose()},[chunks,trail])
  return <group>
    {chunks.map(c=><mesh key={c.x+','+c.z} position={[c.x,0,c.z]} geometry={c.geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1}/>
    </mesh>)}
    <mesh geometry={trail} receiveShadow><meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide}/></mesh>
  </group>
}

