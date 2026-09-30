import SurfaceMaterial from './SurfaceMaterial'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import InstancedModel from './InstancedModel'
import { COTTAGES } from '../utils/regionLayout'
import { getTerrainHeight, getSurfaceHeight } from '../utils/terrain'
import type { Placement } from '../utils/vegetationLayout'

type Vec = [number,number,number]
const timber='#685039', trim='#b28c58', stone='#999384', gold='#edc78a'

// Bake the handcrafted pieces into a few material batches per settlement.
function buildSettlement(origin:boolean) {
  const grounds:THREE.BufferGeometry[]=[]
  const parts:THREE.BufferGeometry[]=[], glow:THREE.BufferGeometry[]=[], water:THREE.BufferGeometry[]=[]
  let basis=new THREE.Matrix4()
  const color=new THREE.Color(), matrix=new THREE.Matrix4(), q=new THREE.Quaternion()
  function add(g:THREE.BufferGeometry,p:Vec,c:string,r:Vec=[0,0,0],target=parts) {
    matrix.compose(new THREE.Vector3(...p),q.setFromEuler(new THREE.Euler(...r)),new THREE.Vector3(1,1,1))
    g.applyMatrix4(matrix).applyMatrix4(basis)
    const rgb=new Float32Array(g.attributes.position.count*3);color.set(c)
    for(let i=0;i<rgb.length;i+=3)color.toArray(rgb,i)
    g.setAttribute('color',new THREE.BufferAttribute(rgb,3));g.deleteAttribute('uv')
    target.push(g.index?g.toNonIndexed():g)
    if(g.index)g.dispose()
  }
  const box=(s:Vec,p:Vec,c:string,r:Vec=[0,0,0],target=parts)=>add(new THREE.BoxGeometry(...s),p,c,r,target)
  function beam(a:Vec,b:Vec,width:number,c=timber) {
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start)
    const g=new THREE.BoxGeometry(width,direction.length(),width)
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()))
    add(g,start.add(end).multiplyScalar(.5).toArray() as Vec,c)
  }
  let pathLayer=0
  function path(points:[number,number][],width=1.15) {
    const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)))
    const samples=curve.getSpacedPoints(Math.ceil(curve.getLength()*4)),v:number[]=[],indices:number[]=[]
    const across=12, lift=.09+pathLayer++*.012
    samples.forEach((p,i)=>{
      const a=samples[Math.max(0,i-1)],b=samples[Math.min(samples.length-1,i+1)]
      const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)
      for(let j=0;j<=across;j++) {
        const offset=(j/across*2-1)*width,x=p.x-dz/len*offset,z=p.z+dx/len*offset
        v.push(x,getSurfaceHeight(x,z)+lift,z)
        if(i<samples.length-1&&j<across){const n=i*(across+1)+j;indices.push(n,n+1,n+across+1,n+1,n+across+2,n+across+1)}
      }
    })
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(indices);g.computeVertexNormals();add(g,[0,0,0],'#a6906b',[0,0,0],grounds)
  }
  function fence(points:[number,number][]) {
    const posts=points.map(([x,z])=>[x,getTerrainHeight(x,z),z] as Vec)
    for(const p of posts)box([.17,1.25,.17],[p[0],p[1]+.6,p[2]],timber)
    for(let i=1;i<posts.length;i++)for(const h of [.45,1])beam([posts[i-1][0],posts[i-1][1]+h,posts[i-1][2]],[posts[i][0],posts[i][1]+h,posts[i][2]],.12,trim)
  }
  function lamp(x:number,z:number) {
    const y=getTerrainHeight(x,z)
    box([.17,2.8,.17],[x,y+1.4,z],timber)
    box([.75,.13,.15],[x+.25,y+2.7,z],timber)
    box([.38,.5,.38],[x+.5,y+2.3,z],gold,[0,0,0],glow)
    for(const dy of [2,2.59])box([.52,.12,.52],[x+.5,y+dy,z],'#454b43')
  }
  for(const b of COTTAGES.filter(b=>(b.id==='home')===origin)) {
    basis.makeRotationY(b.yaw);basis.setPosition(b.x,b.y,b.z)
    const {w,d,h}=b,front=d/2+.04
    box([w+.6,.5,d+.6],[0,.16,0],stone)
    box([w,h,d],[0,h/2+.35,0],b.wall)
    // Individually toned footings and recessed mortar anchor every wall.
    for(let row=0;row<2;row++)for(let i=0;i<Math.ceil(w/.85);i++) {
      const x=-w/2+.4+i*.85;
      for(const side of [-1,1])box([.79,.26,.15],[x,.14+row*.3,side*(d/2+.29)],['#a09b87','#888b7b','#b1a68e'][(i+row)%3])
    }
    for(const side of [-1,1])for(let i=0;i<Math.ceil(d/.85);i++)
      box([.15,.5,.79],[side*(w/2+.29),.29,-d/2+.4+i*.85],i%2?stone:'#898b7a')
    // Eave shadow band and plaster panels give depth without a texture atlas.
    for(const side of [-1,1])box([.12,.23,d],[side*(w/2+.035),h+.15,0],'#9b9277')
    // Masonry plinth, exposed posts and a pitched roof with a real gable.
    for(const x of [-w/2,w/2])for(const z of [-d/2,d/2])box([.24,h+.2,.24],[x,h/2+.35,z],timber)
    for(const y of [.7,h+.25])box([w+.2,.18,d+.2],[0,y,0],timber)
    const rise=w*.37,shape=new THREE.Shape()
    shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(0,rise);shape.closePath()
    add(new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false}),[0,h+.35,-d/2],b.wall)
    const roofAngle=Math.atan2(rise,w/2),roofLength=Math.hypot(w/2+.6,rise+.4)
    for(const side of [-1,1]) {
      box([roofLength,.24,d+1.25],[side*(w/4+.18),h+rise/2+.55,0],b.roof,[0,0,-side*roofAngle])
      for(let row=0;row<5;row++)for(let tile=0;tile<Math.ceil((d+1.1)/.72);tile++) {
        const along=(row+.5)/5, x=side*along*(w/2+.57);
        const y=h+rise+.69-along*(rise+.36);
        const tint=new THREE.Color(b.roof).multiplyScalar(.88+((tile*7+row*3)%9)*.028).getStyle();
        box([roofLength/5+.04,.08,.68],[x,y,-d/2-.2+tile*.72],tint,[0,0,-side*roofAngle])
      }
      for(let z=-d/2-.35;z<=d/2+.4;z+=.72)beam([side*.05,h+rise+.54,z],[side*(w/2+.6),h+.22,z],.065,'#87908a')
      beam([0,h+rise+.57,front+.5],[side*(w/2+.6),h+.19,front+.5],.22,timber)
    }
    box([.24,.22,d+1.5],[0,h+rise+.61,0],timber)
    beam([0,h+.3,front],[0,h+rise+.2,front],.18,timber)
    for(const side of [-1,1])beam([0,h+.5,front],[side*w*.31,h+rise*.6,front],.14,trim)
    // Closed doors are deliberately scenery; no unfinished interior/UI.
    box([1.35,2.6,.15],[0,1.65,front+.08],timber)
    for(let i=0;i<5;i++)box([.19,2.5,.04],[-.48+i*.24,1.65,front+.18],i%2?trim:'#8e704a')
    add(new THREE.SphereGeometry(.07,6,4),[.43,1.55,front+.23],gold)
    box([2.2,.20,1.15],[0,.22,front+.48],stone)
    box([2.8,.13,.8],[0,.08,front+1.25],stone)
    for(const x of [-w*.31,w*.31]) {
      box([1.48,1.65,.13],[x,2.5,front+.12],timber)
      box([1.23,1.38,.06],[x,2.5,front+.20],gold,[0,0,0],glow)
      box([.09,1.48,.1],[x,2.5,front+.28],timber)
      box([1.32,.09,.1],[x,2.5,front+.28],timber)
      for(const side of [-1,1])box([.34,1.68,.14],[x+side*.92,2.5,front+.16],b.roof,[0,side*.18,0])
      box([1.7,.3,.5],[x,1.48,front+.24],trim)
      for(let k=0;k<4;k++)add(new THREE.IcosahedronGeometry(.22,0),[x-.58+k*.39,1.75,front+.3],k%3?'#788b49':'#ddbc86')
    }
    // Side windows make buildings read from the approaching trail.
    for(const side of [-1,1])for(const z of [-d*.26,d*.24]) {
      box([.1,1.4,1.15],[side*(w/2+.08),2.6,z],timber)
      box([.08,1.1,.9],[side*(w/2+.16),2.6,z],gold,[0,0,0],glow)
      box([.1,1.2,.08],[side*(w/2+.21),2.6,z],timber)
    }
    box([.9,2.7,.95],[-w*.28,h+rise*.6,-d*.23],stone)
    box([1.18,.22,1.2],[-w*.28,h+rise*.6+1.4,-d*.23],'#726d62')
    // Each work place has a different silhouette and outdoor activity.
    if(b.id==='workshop'||b.id==='scriptorium') {
      const canopyW=b.id==='workshop'?w+1:w*.72
      box([canopyW,.18,3],[0,3.35,front+1.4],b.id==='workshop'?'#9b8055':'#6f8173',[.09,0,0])
      for(const x of [-canopyW/2+.2,canopyW/2-.2])box([.18,3.25,.18],[x,1.62,front+2.6],timber)
      if(b.id==='scriptorium') {
        box([2.1,1.5,.65],[-2,1,front+1],timber)
        for(let i=0;i<9;i++)box([.15,.52,.4],[-2.8+i*.2,1.25,front+1.08],['#7b936b','#c69e64','#687e8b'][i%3],[0,0,(i%3-1)*.09])
      }
    }
    if(b.id==='growhouse') {
      // Lean-to potting house, opaque jade glazing keeps sorting/draw cost low.
      box([3.6,2.6,5.4],[w/2+1.5,1.55,0],'#839c8a')
      box([4,.14,5.8],[w/2+1.5,3,0],'#adc1aa',[0,0,.18])
      for(let z=-2.7;z<=2.7;z+=.9)box([.1,2.8,.13],[w/2+3.3,1.65,z],trim)
      for(const y of [.3,1.8,2.9])box([.13,.12,5.6],[w/2+3.35,y,0],timber)
    }
    if(b.id==='home') {
      box([.2,1.2,.2],[1.9,.6,front+2.6],timber)
      box([.6,.4,.48],[1.9,1.3,front+2.6],'#7e8c72')
      box([.62,.08,.5],[1.9,1.56,front+2.6],b.roof)
      // A personal garden seat beside the cottage, facing the meadow.
      for(const x of [-2.7,-1.1])box([.15,.55,.55],[x,.28,front+1.2],timber)
      box([2,.15,.7],[-1.9,.61,front+1.2],trim)
    }
  }
  basis.identity()
  if(origin) {
    path([[-94,219],[-90,220],[-87,221]],1.2)
    path([[-94,219],[-89,214],[-84,212]],.8)
    fence([[-88,228],[-85,229],[-81,229],[-77,227]])
    fence([[-77,214],[-80,212],[-83,211]])
    lamp(-88,219)
    // Open lawn by the front gate is the future introduction site.
    for(const [x,z] of [[-87,214],[-89,215],[-85,213]]) {
      add(new THREE.CylinderGeometry(.45,.58,.18,7),[x,getTerrainHeight(x,z)+.03,z],stone)
    }
  } else {
    path([[-53,24],[-53,10],[-52,-8],[-58,-26],[-58,-39]],1.6)
    path([[-58,9],[-56,1],[-48,-4],[-39,-.5]],1.4)
    path([[-52,-7],[-60,-13],[-63,-16]],1.35)
    path([[-51,-13],[-42,-15],[-38,-17]],1.3)
    path([[-59,-23],[-54,-29],[-49,-30]],1.0)
    // A communal spring ties the paths together without occupying the main trail.
    const x=-44,z=-7,y=getTerrainHeight(x,z)
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6
      box([.72,.75,.48],[x+Math.sin(a)*1.38,y+.38,z+Math.cos(a)*1.38],i%2?stone:'#a8a18d',[0,a,0])
    }
    add(new THREE.CircleGeometry(1.15,24),[x,y+.42,z],'#648f87',[-Math.PI/2,0,0],water)
    for(const dx of [-1.65,1.65])box([.22,3.1,.22],[x+dx,y+1.55,z],timber)
    box([3.8,.22,.22],[x,y+3,z],timber)
    beam([x,y+2.95,z],[x,y+.5,z],.045,'#b7a881')
    for(const [x,z] of [[-57,17],[-61,-5],[-45,1],[-44,-22],[-59,-33]])lamp(x,z)
    fence([[-79,9],[-80,3],[-80,-4]])
    fence([[-26,14],[-30,17],[-34,18]])
    // Kitchen-garden beds are grouped at the sunny eastern edge.
    for(let row=0;row<3;row++) {
      const gx=-22-row*3.3,gz=13,y=getTerrainHeight(gx,gz)
      box([2.6,.17,5],[gx,y+.09,gz],'#79634c')
      for(const dx of [-1.4,1.4])box([.15,.26,5.3],[gx+dx,y+.15,gz],trim)
      for(let i=0;i<5;i++)for(const side of [-1,1])add(new THREE.IcosahedronGeometry(.28,0),[gx+side*.55,y+.38,gz-1.8+i*.8],row===1?'#98a45c':'#5b7b4d')
    }
    // Stone-banked mill race and a timber crossing beside the taller workshop.
    const mill=COTTAGES.find(b=>b.id==='mill')!
    basis.makeRotationY(mill.yaw);basis.setPosition(mill.x,mill.y,mill.z)
    box([2.4,.22,12],[5.6,.08,0],stone)
    for(const x of [4.25,6.95])box([.32,.75,12],[x,.35,0],stone)
    box([2.35,.05,11.5],[5.6,.43,0],'#5e9a91',[0,0,0],water)
    for(let i=0;i<9;i++)box([3,.13,.27],[5.6,.78,3.5+i*.3],trim)
    for(const x of [4.15,7.05]) {
      for(const z of [3.35,6])box([.15,1.1,.15],[x,1.27,z],timber)
      beam([x,1.7,3.35],[x,1.7,6],.12,timber)
    }
  }
  const merge=(list:THREE.BufferGeometry[])=>{const merged=list.length?mergeGeometries(list)!:null;list.forEach(g=>g.dispose());return merged}
  return {solid:merge(parts)!,ground:merge(grounds)!,glow:merge(glow),water:merge(water)}
}

const propSites:{kit:string;name:string;sites:[number,number,number,number][]}[]=[
  {kit:'fantasy',name:'cart',sites:[[-74,-8,2.2,1.3],[-40,16,2.1,.6]]},
  {kit:'survival',name:'workbench',sites:[[-64,-12,5.1,1.05],[-27,8,4.7,-.3]]},
  {kit:'survival',name:'workbench-anvil',sites:[[-62,-19,4.4,.6]]},
  {kit:'survival',name:'barrel',sites:[[-73,-11,3.2,0],[-71,-10,2.8,.2],[-39,-29,3.1,.5],[-79,225,2.8,0]]},
  {kit:'survival',name:'box',sites:[[-62,8,3.3,.2],[-61,10,2.5,-.3],[-45,-30,3.7,.1]]},
  {kit:'survival',name:'resource-wood',sites:[[-77,-17,9,.3],[-76,-21,8,.8]]},
]

export default function Settlements() {
  const batches=useMemo(()=>[buildSettlement(true),buildSettlement(false)],[])
  const props=useMemo(()=>propSites.map(p=>({...p,placements:p.sites.map(([x,z,scale,rotationY])=>({position:[x,getTerrainHeight(x,z),z],rotationY,scale} as Placement))})),[])
  useEffect(()=>()=>batches.forEach(b=>{b.solid.dispose();b.ground.dispose();b.glow?.dispose();b.water?.dispose()}),[batches])
  return <group>
    {batches.map((b,i)=><group key={i}>
      <mesh geometry={b.ground} receiveShadow><SurfaceMaterial strength={.24}/></mesh>
      <mesh geometry={b.solid} userData={{ solid: true }} castShadow receiveShadow><SurfaceMaterial side={THREE.DoubleSide} strength={0.24} /></mesh>
      {b.glow&&<mesh geometry={b.glow}><meshStandardMaterial vertexColors emissive="#e8ac57" emissiveIntensity={.22} roughness={.65}/></mesh>}
      {b.water&&<mesh geometry={b.water}><meshStandardMaterial vertexColors roughness={.25} metalness={.15}/></mesh>}
    </group>)}
    {props.map(p=><InstancedModel key={p.name} url={`/assets/settlement/${p.kit}/${p.name}.glb`} placements={p.placements}/>)}
  </group>
}
