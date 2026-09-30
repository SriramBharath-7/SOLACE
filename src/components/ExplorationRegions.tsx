import SurfaceMaterial from './SurfaceMaterial'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { getTerrainHeight, getSurfaceHeight } from '../utils/terrain'
import { mulberry32 } from '../utils/noise'
import { FOREST_TRAILS } from '../utils/regionLayout'
import type { Placement } from '../utils/vegetationLayout'
import InstancedModel from './InstancedModel'

type Point = [number, number, number]
const UP = new THREE.Vector3(0, 1, 0)
const wood = '#766043', paleWood = '#ad8c59', stone = '#939d89', dark = '#394944'

/** Static details share vertex-coloured geometry rather than a draw call per plank. */
function buildExploration() {
  const parts: THREE.BufferGeometry[] = [], canvas: THREE.BufferGeometry[] = []
  const random = mulberry32(428)
  const matrix = new THREE.Matrix4(), color = new THREE.Color()
  let origin = new THREE.Vector3(), yaw = 0

  function place(x: number, z: number, rotation = 0) {
    origin.set(x, getTerrainHeight(x, z), z)
    yaw = rotation
  }
  function world(p: Point) {
    return new THREE.Vector3(...p).applyAxisAngle(UP, yaw).add(origin)
  }
  function add(geometry: THREE.BufferGeometry, tint: string, position: Point, rotation = new THREE.Quaternion(), cloth = false) {
    const geometryColor = new Float32Array(geometry.attributes.position.count * 3)
    color.set(tint)
    for (let i = 0; i < geometry.attributes.position.count; i++) color.toArray(geometryColor, i * 3)
    geometry.setAttribute('color', new THREE.BufferAttribute(geometryColor, 3))
    geometry.deleteAttribute('uv')
    matrix.compose(world(position), new THREE.Quaternion().setFromAxisAngle(UP, yaw).multiply(rotation), new THREE.Vector3(1, 1, 1))
    geometry.applyMatrix4(matrix)
    // Uniform non-indexed parts allow boxes, curved members and custom cloth to merge.
    const flat = geometry.index ? geometry.toNonIndexed() : geometry
    if (flat !== geometry) geometry.dispose()
    ;(cloth ? canvas : parts).push(flat)
  }
  function box(position: Point, size: Point, tint = wood, rotation?: THREE.Quaternion) {
    add(new THREE.BoxGeometry(...size), tint, position, rotation)
  }
  function beam(a: Point, b: Point, radius: number, tint = wood) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b)
    const direction = end.clone().sub(start)
    add(new THREE.CylinderGeometry(radius, radius * 1.05, direction.length(), 6), tint,
      start.add(end).multiplyScalar(0.5).toArray() as Point,
      new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize()))
  }
  function boulder(p: Point, scale: Point, tint = stone) {
    const geometry = new THREE.DodecahedronGeometry(1, 0)
    geometry.scale(...scale)
    add(geometry, tint, p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0.13, random() * 6, 0.1)))
  }
  function groundPoint(x: number, z: number, lift = 0): Point {
    const p = world([x, 0, z])
    return [x, getTerrainHeight(p.x, p.z) - origin.y + lift, z]
  }
  function lantern(x: number, z: number, height = 1.7) {
    const ground = groundPoint(x, z)
    beam(ground, [x, ground[1] + height, z], 0.075)
    beam([x, ground[1] + height, z], [x + 0.42, ground[1] + height, z], 0.065)
    box([x + 0.42, ground[1] + height - 0.29, z], [0.3, 0.42, 0.3], '#eed9a0')
    for (const y of [height - 0.52, height - 0.05]) box([x + 0.42, ground[1] + y, z], [0.39, 0.07, 0.39], dark)
    for (const dx of [-0.16, 0.16]) for (const dz of [-0.16, 0.16]) {
      box([x + 0.42 + dx, ground[1] + height - 0.29, z + dz], [0.035, 0.47, 0.035], dark)
    }
  }
  function sign(x: number, z: number, rotation: number, branches = false) {
    place(x, z, rotation)
    beam([0, -0.12, 0], [0, 2.55, 0], 0.13)
    for (let i = 0; i < (branches ? 2 : 1); i++) {
      const height = 2.1 - i * 0.62, direction = i ? -1 : 1
      box([0.28 * direction, height, 0], [1.65, 0.42, 0.17], paleWood)
      const head = new THREE.ConeGeometry(0.35, 0.4, 3)
      head.rotateZ(-direction * Math.PI / 2)
      head.rotateX(Math.PI / 2)
      add(head, paleWood, [direction * 1.16, height, 0])
      // A route blaze, with no portfolio labels or interaction surface.
      box([-0.23, height, 0.092], [0.12, 0.26, 0.012], i ? '#a4c2b1' : '#eee1b7')
    }
    boulder(groundPoint(-0.36, 0.16, 0.13), [0.43, 0.3, 0.35])
  }

  // The camp sits beside the loop. Its open front looks back toward the trail.
  place(-74.8, -117.5, -0.2)
  const corners: Point[] = [[-3.2, 3.7, -2.5], [3.2, 3.4, -2.5], [-3.2, 3.4, 2.5], [3.2, 3.7, 2.5]]
  corners.forEach(([x, y, z]) => {
    beam(groundPoint(x, z, -0.15), [x, y + 0.22, z], 0.11)
    const peg = groundPoint(x * 1.23, z * 1.35, 0.08)
    beam([x, y, z], peg, 0.022, '#bba47b')
    beam(peg, [peg[0], peg[1] + 0.3, peg[2]], 0.055, paleWood)
  })
  beam([-3.2, 3.7, -2.5], [3.2, 3.4, -2.5], 0.08)
  const cloth = new THREE.PlaneGeometry(6.4, 5, 10, 8)
  cloth.rotateX(-Math.PI / 2)
  const vertices = cloth.attributes.position
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), z = vertices.getZ(i)
    const edge = Math.max(Math.abs(x) / 3.2, Math.abs(z) / 2.5)
    vertices.setY(i, 3.55 + x * z * 0.019 - (1 - edge * edge) * 0.55)
  }
  cloth.computeVertexNormals()
  add(cloth, '#d8c595', [0, 0, 0], undefined, true)

  // A broad field table and its paper survey tell the story without text panels.
  box([0, 1.12, -0.55], [3.5, 0.17, 1.25], paleWood)
  for (const x of [-1.37, 1.37]) for (const z of [-0.96, -0.16]) {
    beam(groundPoint(x, z, -0.05), [x, 1.08, z], 0.11)
  }
  box([0.15, 1.22, -0.52], [1.5, 0.02, 0.77], '#e2d6ad')
  for (let i = 0; i < 4; i++) {
    box([-0.42 + i * 0.31, 1.235, -0.56 + Math.sin(i) * 0.18], [0.24, 0.012, 0.018], '#79947c')
  }
  box([-1.02, 1.26, -0.45], [0.42, 0.09, 0.5], '#5a7775')
  box([-0.98, 1.34, -0.45], [0.4, 0.08, 0.46], '#997e58')
  lantern(3.9, 1.4, 2.1)
  // Empty A-frame blackboard is an environmental research prop, not final UI.
  for (const x of [-0.96, 0.96]) {
    beam([x + 3.8, -0.05, 0.2], [x + 3.8, 2.85, -0.42], 0.08)
    beam([x + 3.8, -0.05, -1.05], [x + 3.8, 2.85, -0.42], 0.08)
  }
  box([3.8, 1.85, -0.33], [1.86, 1.74, 0.12], paleWood)
  box([3.8, 1.85, -0.255], [1.59, 1.47, 0.03], '#3c6158')
  const nodes: Point[] = [[3.31, 2.2, -0.23], [4.07, 2.35, -0.23], [3.75, 1.63, -0.23], [3.33, 1.35, -0.23], [4.2, 1.38, -0.23]]
  for (const [a, b] of [[0, 1], [0, 2], [1, 2], [2, 3], [2, 4]]) beam(nodes[a], nodes[b], 0.014, '#a8c5af')
  nodes.forEach(node => boulder(node, [0.065, 0.065, 0.02], '#d0d8be'))

  // A quieter fork holds an old survey instrument and a marked stone, tucked
  // under the forest instead of turning Curiosity into another village.
  place(-84, -144, 0.55)
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3
    beam(groundPoint(Math.cos(angle) * 0.85, Math.sin(angle) * 0.85), [0, 1.65, 0], 0.055, paleWood)
  }
  beam([-0.55, 1.75, 0], [0.7, 2.02, 0], 0.12, '#6c8c7b')
  beam([0.56, 1.99, 0], [0.75, 2.03, 0], 0.16, '#b59c64')
  box([-1.9, 0.58, 0.15], [0.66, 0.12, 0.66], paleWood)
  for (const x of [-2.13, -1.67]) for (const z of [-0.08, 0.38]) beam(groundPoint(x, z), [x, 0.55, z], 0.05)
  boulder(groundPoint(2.4, -1.2, 0.66), [0.75, 1.05, 0.49])
  // Small hand-painted shield outline: a quiet reference to security research.
  const shield: Point[] = [[2.09, 1.05, -0.78], [2.67, 1.05, -0.78], [2.63, 0.66, -0.78], [2.38, 0.46, -0.78], [2.13, 0.66, -0.78], [2.09, 1.05, -0.78]]
  for (let i = 1; i < shield.length; i++) beam(shield[i - 1], shield[i], 0.023, '#b9d4bf')

  sign(-101.9, -106.8, 0.7, true)
  sign(-96.9, -140.7, -0.5, true)
  sign(-82.6, -68.2, 0.3)

  // Forest exit: small standing stones frame a pause toward falls and railway.
  place(-43.6, -178.2, -0.25)
  for (const [x, z, height] of [[-3.9, 1.8, 0.7], [-2.7, 2.3, 0.4], [2.8, 1.5, 0.8], [3.5, 0.8, 0.44]]) {
    boulder(groundPoint(x, z, height * 0.25), [height * 1.2, height, height * 0.9])
  }
  for (const x of [-1.05, 1.05]) beam(groundPoint(x, 2.1, -0.1), groundPoint(x, 2.1, 1.07), 0.08)
  beam(groundPoint(-1.05, 2.1, 1.03), groundPoint(1.05, 2.1, 1.03), 0.08, paleWood)

  // Handcrafted Horizon bench: front (+Z) faces back over the complete valley.
  place(101, -334, -0.44)
  for (const x of [-1.62, 1.62]) {
    for (const z of [-0.35, 0.4]) {
      box([x, 0.41, z], [0.2, 0.88, 0.2], dark)
      boulder(groundPoint(x, z, 0.03), [0.34, 0.12, 0.3], '#9b9d88')
    }
    box([x, 1.05, -0.43], [0.18, 1.26, 0.18], wood)
    box([x, 0.73, 0.02], [0.22, 0.2, 1.04], wood)
    box([x, 1.2, 0.22], [0.18, 0.67, 0.18], wood)
    box([x, 1.42, 0], [0.25, 0.12, 1.12], paleWood)
  }
  for (let i = 0; i < 4; i++) box([0, 0.87, -0.32 + i * 0.235], [4.35, 0.13, 0.2], i % 2 ? '#b08a56' : '#987347')
  for (let i = 0; i < 3; i++) {
    box([0, 1.12 + i * 0.235, -0.49], [4.35, 0.19, 0.13], i % 2 ? '#af8b58' : '#927248')
    for (const x of [-1.62, 1.62]) {
      add(new THREE.SphereGeometry(0.032, 5, 3), dark, [x, 1.12 + i * 0.235, -0.407])
    }
  }
  // Low edge fragments retain an uninterrupted eyeline over the valley.
  for (let i = 0; i < 15; i++) {
    const angle = -0.14 + i / 14 * Math.PI * 1.25
    const x = Math.cos(angle) * 5.5, z = Math.sin(angle) * 4.1
    if (x > 3.1 && z < 0.8) continue
    boulder(groundPoint(x, z, 0.08), [0.36 + random() * 0.2, 0.18 + random() * 0.14, 0.3 + random() * 0.16], '#a6a38b')
  }
  // A modest approach cairn marks the last bend, leaving the oak dominant.
  place(111.2, -347.5)
  for (let i = 0; i < 4; i++) boulder([i % 2 * 0.04, 0.17 + i * 0.27, 0], [0.62 - i * 0.12, 0.19, 0.46 - i * 0.075])

  const merge = (list: THREE.BufferGeometry[]) => {
    const merged = mergeGeometries(list)!
    list.forEach(geometry => geometry.dispose())
    return merged
  }
  return { solid: merge(parts), cloth: merge(canvas) }
}

function buildTrailsAndClearings() {
  const vertices: number[] = [], colors: number[] = []
  const color = new THREE.Color()
  const add = (x: number, z: number, tint: string) => {
    vertices.push(x, getSurfaceHeight(x, z) + 0.08, z)
    color.set(tint).toArray(colors, colors.length)
  }
  for (const controls of FOREST_TRAILS) {
    const curve = new THREE.CatmullRomCurve3(controls.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal')
    const points = curve.getSpacedPoints(Math.ceil(curve.getLength() / 0.8))
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i]
      const ta=b.clone().sub(points[Math.max(0,i-2)]).normalize(),tb=points[Math.min(points.length-1,i+1)].clone().sub(a).normalize()
      const width = 0.9
      const ax = a.x - ta.z * width, az = a.z + ta.x * width
      const bx = a.x + ta.z * width, bz = a.z - ta.x * width
      const cx = b.x - tb.z * width, cz = b.z + tb.x * width
      const dx = b.x + tb.z * width, dz = b.z - tb.x * width
      const tint = '#a49a73'
      for(let across=0;across<8;across++)for(let along=0;along<3;along++) {
        const point=(u:number,v:number)=>[
          THREE.MathUtils.lerp(THREE.MathUtils.lerp(ax,bx,u),THREE.MathUtils.lerp(cx,dx,u),v),
          THREE.MathUtils.lerp(THREE.MathUtils.lerp(az,bz,u),THREE.MathUtils.lerp(cz,dz,u),v)]
        const a=point(across/8,along/3),b=point((across+1)/8,along/3),c=point(across/8,(along+1)/3),d=point((across+1)/8,(along+1)/3)
        for(const [x,z] of [a,c,b,b,c,d])add(x,z,tint)
      }
    }
  }
  for (const [x, z, rx, rz] of [[-78, -118, 6.1, 5.9], [-84, -144, 3.9, 3.4], [101, -334, 4.7, 3.5]]) {
    for (let i = 0; i < 36; i++) {
      const angle = i / 36 * Math.PI * 2, next = (i + 1) / 36 * Math.PI * 2
      const ripple = 1 + Math.sin(i * 2.35) * 0.06
      add(x, z, '#9f986f')
      add(x + Math.cos(next) * rx * (1 + Math.sin((i + 1) * 2.35) * 0.06), z + Math.sin(next) * rz, '#aaa17d')
      add(x + Math.cos(angle) * rx * ripple, z + Math.sin(angle) * rz, '#aaa17d')
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

function buildProps() {
  const props: Record<string, Placement[]> = {}
  function add(name: string, x: number, z: number, scale: number, rotationY = 0, lift = 0) {
    const list = props[name] ??= []
    list.push({ position: [x, getTerrainHeight(x, z) + lift, z], scale, rotationY })
  }
  add('chest', -72.1, -119.7, 3.5, -0.2)
  add('box', -72, -117.7, 3.1, 0.14)
  add('box-open', -72.1, -116.7, 2.6, -0.21)
  add('bedroll-frame', -75.6, -115.6, 3.5, 1.4)
  add('bottle', -74.15, -118.2, 2.9, 0, 1.25)
  add('bottle-large', -73.8, -118.35, 2.5, 0, 1.25)
  add('tree-log', -90.5, -120.8, 3.4, 0.65, -0.25)
  add('tree-log', -86.4, -148.4, 4.1, 0.9, -0.12)
  add('chest', -82.8, -146.1, 2.8, 0.65)
  return props
}

function buildPlanting() {
  const flowers: Placement[] = [], grass: Placement[] = [], ferns: Placement[] = []
  const random = mulberry32(247)
  for (const [cx, cz, radius, count] of [[97, -339, 3.1, 30], [106, -329, 2.4, 26], [109, -345, 2.3, 24], [-86, -117, 3, 27], [-71, -122, 3.7, 35], [-88, -146, 2.8, 24], [-45, -176, 2.6, 18]]) {
    for (let i = 0; i < count; i++) {
      const a = random() * Math.PI * 2, r = Math.sqrt(random()) * radius
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r * 0.62
      const list = i % 3 === 0 ? flowers : z > -200 && i % 3 === 1 ? ferns : grass
      list.push({ position: [x, getTerrainHeight(x, z) - 0.025, z], rotationY: random() * 6.28, scale: 0.95 + random() * 0.7 })
    }
  }
  return { flowers, grass, ferns }
}

export default function ExplorationRegions() {
  const geometry = useMemo(buildExploration, [])
  const trails = useMemo(buildTrailsAndClearings, [])
  const props = useMemo(buildProps, [])
  const planting = useMemo(buildPlanting, [])
  useEffect(() => () => {
    geometry.solid.dispose()
    geometry.cloth.dispose()
    trails.dispose()
  }, [geometry, trails])
  return <group>
    <mesh geometry={geometry.solid} userData={{ solid: true }} castShadow receiveShadow><SurfaceMaterial strength={0.25} /></mesh>
    <mesh geometry={geometry.cloth} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={trails} receiveShadow><meshStandardMaterial vertexColors roughness={1} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} /></mesh>
    {Object.entries(props).map(([name, placements]) => <InstancedModel key={name} url={`/assets/exploration/${name}.glb`} placements={placements} />)}
    <InstancedModel url="/assets/models/flower-yellow.glb" placements={planting.flowers} wind castShadow={false} />
    <InstancedModel url="/assets/models/grass-large.glb" placements={planting.grass} wind castShadow={false} />
    <InstancedModel url="/assets/models/grass-leafs-large.glb" placements={planting.ferns} wind castShadow={false} />
  </group>
}
