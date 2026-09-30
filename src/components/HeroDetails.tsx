import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { COTTAGES, onWorkingLane, insideCottage, nearestForestTrail } from '../utils/regionLayout'
import { getSurfaceHeight, riverX, riverHalfWidth } from '../utils/terrain'
import { distanceToPath } from '../utils/path'
import { mulberry32 } from '../utils/noise'
import type { Placement } from '../utils/vegetationLayout'
import InstancedModel from './InstancedModel'
import SurfaceMaterial from './SurfaceMaterial'

function buildDetails() {
  const parts: THREE.BufferGeometry[] = [], beds: THREE.BufferGeometry[] = []
  const plants: Record<string, Placement[]> = { 'grass-large': [], 'grass-leafs-large': [], 'flower-yellow': [], 'flower-purple': [] }
  const random = mulberry32(2509), color = new THREE.Color()
  function add(g: THREE.BufferGeometry, x: number, y: number, z: number, tint: string, ground = false) {
    g.translate(x, y, z)
    const flat = g.index ? g.toNonIndexed() : g
    if (flat !== g) g.dispose()
    flat.deleteAttribute('uv')
    const rgb = new Float32Array(flat.attributes.position.count * 3)
    color.set(tint)
    for (let i = 0; i < rgb.length; i += 3) color.toArray(rgb, i)
    flat.setAttribute('color', new THREE.BufferAttribute(rgb, 3))
    ;(ground ? beds : parts).push(flat)
  }
  function rock(x: number, z: number, size: number, tint = '#929583', height = .55) {
    const g = new THREE.DodecahedronGeometry(1, 0)
    g.scale(size, size * height, size * .72).rotateY(random() * 6)
    add(g, x, getSurfaceHeight(x, z) + size * height * .18, z, tint)
  }
  function bed(x: number, z: number, rx: number, rz: number, tint: string) {
    const g = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const px = x + p.getX(i) * rx, pz = z + p.getZ(i) * rz
      p.setXYZ(i, px, getSurfaceHeight(px, pz) + .032, pz)
    }
    g.computeVertexNormals(); add(g, 0, 0, 0, tint, true)
  }
  // Planting is arranged in crescents around chosen edges, never uniformly across a region.
  const gardens = [
    [-88,225,2.5,1.3],[-87,215,2.1,1.2],[-78,218,2.2,1.8],[-80,227,2,1],
    [-74,11,3,1.8],[-62,4,2,1.3],[-75,-23,2.8,1.4],[-29,-14,2.7,1.5],[-42,-33,2,1.3],[-29,12,2,1.1],
    [-81,-122,2.8,1.6],[-89,-147,2.5,1.2],[-70,-115,2,1.4],
    [97,-337,2.1,1.2],[107,-331,2.5,1.2],[112,-344,2.1,1.3],
    [-96,-60,3.3,2],[-33,-59,3,2],[95,-71,3,2],
  ]
  gardens.forEach(([x,z,rx,rz], index) => {
    bed(x,z,rx,rz,index<10?'#697348':'#62734d')
    for(let i=0;i<42;i++) {
      const a=random()*Math.PI*2,r=Math.sqrt(random()),px=x+Math.cos(a)*r*rx,pz=z+Math.sin(a)*r*rz
      if(onWorkingLane(px,pz)||insideCottage(px,pz,.3)||distanceToPath(px,pz)<2.1||nearestForestTrail(px,pz).distance<1.2)continue
      const name=i%7===0?'flower-purple':i%4===0?'flower-yellow':i%3===0?'grass-leafs-large':'grass-large'
      plants[name].push({position:[px,getSurfaceHeight(px,pz)-.035,pz],scale:.75+random()*.8,rotationY:a})
    }
    for(let i=0;i<8;i++) {
      const a=.2+i/8*Math.PI*1.4
      rock(x+Math.cos(a)*rx,z+Math.sin(a)*rz,.19+random()*.2,'#a4a18a',.5)
    }
  })
  // Hearth-side gardens, stacked split timber, and tools stored against each workshop.
  COTTAGES.forEach(b => {
    const local=(x:number,z:number)=>[b.x+Math.cos(b.yaw)*x+Math.sin(b.yaw)*z,b.z-Math.sin(b.yaw)*x+Math.cos(b.yaw)*z]
    for(let i=0;i<10;i++) {
      const [x,z]=local(-b.w/2-.3,-b.d/2+i*b.d/10)
      rock(x,z,.22+random()*.18,'#7d8568',.6)
    }
    const [lx,lz]=local(b.w/2+1,-1.1)
    bed(lx,lz,1.6,1.8,'#746d50')
    for(let row=0;row<3;row++)for(let i=0;i<4-row;i++) {
      const [x,z]=local(b.w/2+.7+i*.35+row*.16,-1.1)
      const g=new THREE.CylinderGeometry(.16,.18,1.7,7).rotateX(Math.PI/2).rotateY(b.yaw)
      add(g,x,getSurfaceHeight(lx,lz)+.2+row*.29,z,(i+row)%2?'#987a50':'#725a3e')
    }
    if(b.id==='workshop'||b.id==='store')for(let i=0;i<6;i++) {
      const [x,z]=local(-b.w/2-1.1,-1+i*.35)
      const g=new THREE.BoxGeometry(2.6,.13,.28).rotateY(b.yaw+.12)
      add(g,x,getSurfaceHeight(x,z)+.15+(i%2)*.14,z,i%2?'#aa8859':'#896b44')
    }
  })
  // River-washed talus links the falling sheet to its basin, with darker wet toes.
  for(const side of [-1,1])for(let i=0;i<26;i++) {
    const z=-189+i*1.55,x=riverX(z)+side*(riverHalfWidth(z)+.25+random()*2)
    if(z < -164 && z > -184)continue
    rock(x,z,.45+random()*1.35,i%3?'#647f75':'#8a9d8a',.72)
  }
  // Small trail fragments and survey samples around the discoveries.
  for(const [cx,cz] of [[-72,-121],[-86,-145],[102,-337]])for(let i=0;i<9;i++) {
    const x=cx+(random()-.5)*2,z=cz+(random()-.5)*1.4
    rock(x,z,.1+random()*.16,'#b7b298',.4)
  }
  // Worn hand-laid flags make the final seat a small destination, not a loose prop.
  for(let row=0;row<5;row++)for(let col=0;col<8;col++) {
    const x=98.4+col*.72+(row%2)*.18,z=-335.4+row*.73
    if(Math.hypot((x-101)/1.35,z+334)>2.4)continue
    const g=new THREE.BoxGeometry(.66,.12,.66).rotateY((random()-.5)*.09)
    add(g,x,getSurfaceHeight(x,z)+.10,z,['#a6a18a','#969984','#b1aa90'][(row+col)%3])
  }
  const merge=(list:THREE.BufferGeometry[])=>{const g=mergeGeometries(list)!;list.forEach(p=>p.dispose());return g}
  return {solid:merge(parts),beds:merge(beds),plants}
}

function buildAir() {
  const positions:number[]=[], phases:number[]=[], kinds:number[]=[]
  const random=mulberry32(983)
  for(const b of COTTAGES.filter(b=>['home','workshop','mill'].includes(b.id))) {
    const lx=-b.w*.28,lz=-b.d*.23
    for(let i=0;i<14;i++) {
      positions.push(b.x+Math.cos(b.yaw)*lx+Math.sin(b.yaw)*lz,b.y+b.h+b.w*.37*.6+1.55,b.z-Math.sin(b.yaw)*lx+Math.cos(b.yaw)*lz)
      phases.push(random());kinds.push(1)
    }
  }
  for(const [x,z] of [[-88,221],[-77,-119],[-86,-144],[105,-335]])for(let i=0;i<18;i++) {
    const px=x+(random()-.5)*14,pz=z+(random()-.5)*10
    positions.push(px,getSurfaceHeight(px,pz)+.4+random()*3,pz);phases.push(random());kinds.push(0)
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  geometry.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1))
  geometry.setAttribute('kind',new THREE.Float32BufferAttribute(kinds,1))
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:true,
    uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{time:{value:0}}]),
    vertexShader:`
      uniform float time; attribute float phase; attribute float kind;
      varying float alpha; varying float smoke;
      #include <fog_pars_vertex>
      void main(){
        float age=fract(phase+time*.075); vec3 p=position; smoke=kind;
        p.x+=kind*(age*3.5+sin(age*5.0+phase)*.35)+(1.0-kind)*sin(time*.3+phase*30.0)*.7;
        p.y+=kind*age*6.0+(1.0-kind)*sin(time*.45+phase*20.0)*.3;
        p.z+=kind*age*1.3;
        alpha=sin(age*3.14159)*mix(.48,.16,kind);
        vec4 mvPosition=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mvPosition;
        gl_PointSize=clamp(mix(.035,.55+age*1.8,kind)*600.0/-mvPosition.z,1.0,70.0);
        #include <fog_vertex>
      }`,fragmentShader:`
      varying float alpha; varying float smoke;
      #include <fog_pars_fragment>
      void main(){
        float r=length(gl_PointCoord-.5)*2.0;
        float a=(1.0-smoothstep(.05,1.0,r))*alpha;
        if(a<.003)discard;
        gl_FragColor=vec4(mix(vec3(.88,.78,.45),vec3(.65,.69,.64),smoke),a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`})
  geometry.computeBoundingSphere();geometry.boundingSphere!.radius+=10
  return {geometry,material}
}

export default function HeroDetails(){
  const details=useMemo(buildDetails,[]),air=useMemo(buildAir,[])
  useFrame(({clock})=>{air.material.uniforms.time.value=clock.elapsedTime})
  useEffect(()=>()=>{details.solid.dispose();details.beds.dispose();air.geometry.dispose();air.material.dispose()},[details,air])
  return <group>
    <mesh geometry={details.solid} castShadow receiveShadow><SurfaceMaterial strength={.28}/></mesh>
    <mesh geometry={details.beds} receiveShadow><SurfaceMaterial strength={.35}/></mesh>
    {Object.entries(details.plants).map(([name,placements])=><InstancedModel key={name} url={`/assets/models/${name}.glb`} placements={placements} wind castShadow={false}/>)}
    <points geometry={air.geometry} material={air.material}/>
  </group>
}
