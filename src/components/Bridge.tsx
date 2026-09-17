import { BRIDGE_X, BRIDGE_Y, BRIDGE_Z, BRIDGE_HALF_LENGTH } from '../utils/terrain'

// A simple walkable crossing. The railway site farther downstream stays empty.
export default function Bridge(){
  const length=BRIDGE_HALF_LENGTH*2
  const posts=Array.from({length:9},(_,i)=>-BRIDGE_HALF_LENGTH+i*length/8)
  return <group position={[BRIDGE_X,BRIDGE_Y,BRIDGE_Z]}>
    <mesh position={[0,-0.18,0]} castShadow receiveShadow>
      <boxGeometry args={[length,0.36,4.5]}/><meshStandardMaterial color="#8b7855" roughness={1}/>
    </mesh>
    {[-2.12,2.12].map(z=><group key={z}>
      <mesh position={[0,-0.48,z]} castShadow><boxGeometry args={[length+0.6,0.65,0.3]}/><meshStandardMaterial color="#655d45"/></mesh>
      <mesh position={[0,1.1,z]} castShadow><boxGeometry args={[length,0.14,0.16]}/><meshStandardMaterial color="#74694e"/></mesh>
      {posts.map(x=><mesh key={x} position={[x,0.5,z]} castShadow><boxGeometry args={[0.18,1.4,0.18]}/><meshStandardMaterial color="#6c624a"/></mesh>)}
    </group>)}
    {Array.from({length:47},(_,i)=><mesh key={i} position={[-13.8+i*0.6,0.012,0]} receiveShadow>
      <boxGeometry args={[0.035,0.025,4.35]}/><meshStandardMaterial color="#665e49"/>
    </mesh>)}
  </group>
}

