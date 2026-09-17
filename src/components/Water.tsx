import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { riverX, riverLevel, riverHalfWidth } from '../utils/terrain'

export default function Water(){
  const geometry=useMemo(()=>{
    const vertices:number[]=[],colors:number[]=[],indices:number[]=[]
    const color=new THREE.Color()
    for(let row=0;row<=320;row++){
      const z=-315+row*2
      for(let col=0;col<=6;col++){
        const t=col/6
        vertices.push(riverX(z)+(t*2-1)*riverHalfWidth(z),riverLevel(z)+0.04,z)
        color.set('#377e80').lerp(new THREE.Color('#8cb5a0'),Math.abs(t*2-1)**3*0.6)
        color.multiplyScalar(0.94+Math.sin(z*0.47+t*7)*0.035)
        colors.push(color.r,color.g,color.b)
        if(row<320&&col<6){
          const n=row*7+col;indices.push(n,n+7,n+1,n+1,n+7,n+8)
        }
      }
    }
    const g=new THREE.BufferGeometry()
    g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3))
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3))
    g.setIndex(indices);g.computeVertexNormals()
    return g
  },[])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <mesh geometry={geometry} receiveShadow>
    <meshStandardMaterial vertexColors roughness={0.3} metalness={0.12} side={THREE.DoubleSide}/>
  </mesh>
}

