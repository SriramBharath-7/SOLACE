import SurfaceMaterial from './SurfaceMaterial'
import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { getTerrainHeight } from '../utils/terrain'
import { RAIL_CAR_SPACING, RAIL_HEIGHT, RAIL_PORTAL_X, RAIL_SPEED, RAIL_Z, sampleTrain } from '../utils/railway'

const TRAIN_SCALE = 2.1
const TRACK_TOP = RAIL_HEIGHT + 0.35
const locomotiveUrl = '/assets/railway/train-locomotive-a.glb'
const carriageUrl = '/assets/railway/train-locomotive-passenger-a.glb'

function buildRailway() {
  const stone: THREE.BufferGeometry[] = [], iron: THREE.BufferGeometry[] = []
  const timber: THREE.BufferGeometry[] = [], gravel: THREE.BufferGeometry[] = []
  const darkness: THREE.BufferGeometry[] = []
  function add(parts: THREE.BufferGeometry[], source: THREE.BufferGeometry, color?: string) {
    const geometry = source.index ? source.toNonIndexed() : source
    if (geometry !== source) source.dispose()
    if (color) {
      const c = new THREE.Color(color), colors = new Float32Array(geometry.attributes.position.count * 3)
      for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i)
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    }
    parts.push(geometry)
  }
  function box(parts: THREE.BufferGeometry[], x: number, y: number, z: number,
    width: number, height: number, depth: number, color?: string) {
    add(parts, new THREE.BoxGeometry(width, height, depth).translate(x, y, z), color)
  }
  const deck = RAIL_HEIGHT - 0.4
  // Five genuinely open spans. Their piers miss both the river and walking trail.
  const piers = [-158, -94, -31, 32, 95, 158]
  for (let i = 0; i < piers.length; i++) {
    const x = piers[i]
    const ground = Math.min(...[-4, 4].flatMap(dx => [-4, 4].map(dz => getTerrainHeight(x + dx, RAIL_Z + dz)))) - 1.8
    box(stone, x, (ground + deck) / 2, RAIL_Z, 7.6, deck - ground, 7.3, '#a9a48e')
    box(stone, x, ground + 1.3, RAIL_Z, 10, 2.6, 9, '#8a8b78')
    // Rusticated pier edges and a darker drip course make the stone legible at distance.
    for (let y = ground + 4; y < deck - 2; y += 3.7) {
      for (const side of [-1, 1]) box(stone, x, y, RAIL_Z + side * 3.73, 7.9, 0.42, 0.32, '#bdb69b')
    }
  }
  for (let span = 0; span < piers.length - 1; span++) {
    const left = piers[span] + 3.8, right = piers[span + 1] - 3.8
    const cx = (left + right) / 2, rx = (right - left) / 2
    const spring = 20.5, rise = 18.2
    const arch = new THREE.Shape().moveTo(left, deck).lineTo(right, deck).lineTo(right, spring)
    for (let j = 1; j <= 24; j++) {
      const angle = j / 24 * Math.PI
      arch.lineTo(cx + Math.cos(angle) * rx, spring + Math.sin(angle) * rise)
    }
    arch.closePath()
    add(stone, new THREE.ExtrudeGeometry(arch, { depth: 7.3, bevelEnabled: false, steps: 1, curveSegments: 24 })
      .translate(0, 0, RAIL_Z - 3.65), '#aaa48e')
    // Individual wedge stones trace the open arch, on both faces of the bridge.
    for (let j = 0; j < 25; j++) {
      const a = j / 25 * Math.PI + 0.004, b = (j + 1) / 25 * Math.PI - 0.004
      const wedge = new THREE.Shape()
      wedge.moveTo(cx + Math.cos(a) * rx, spring + Math.sin(a) * rise)
      wedge.lineTo(cx + Math.cos(b) * rx, spring + Math.sin(b) * rise)
      wedge.lineTo(cx + Math.cos(b) * (rx + 0.9), spring + Math.sin(b) * (rise + 1.25))
      wedge.lineTo(cx + Math.cos(a) * (rx + 0.9), spring + Math.sin(a) * (rise + 1.25)).closePath()
      for (const side of [-1, 1]) add(stone,
        new THREE.ExtrudeGeometry(wedge, { depth: 0.3, bevelEnabled: false }).translate(0, 0, RAIL_Z + side * 3.65 - 0.15),
        j % 3 === 0 ? '#c8c0a5' : '#bbb499')
    }
  }
  box(stone, 0, deck + 0.15, RAIL_Z, 324, 0.65, 8.2, '#c2bca5')
  box(gravel, 0, RAIL_HEIGHT - 0.02, RAIL_Z, 350, 0.22, 5.3)
  for (const side of [-1, 1]) {
    box(stone, 0, RAIL_HEIGHT + 0.43, RAIL_Z + side * 3.67, 305, 1.15, 0.68, '#999781')
    box(stone, 0, RAIL_HEIGHT + 1.04, RAIL_Z + side * 3.67, 307, 0.2, 0.88, '#c9c2a7')
    box(iron, 0, RAIL_HEIGHT + 0.24, RAIL_Z + side * 1.02, 360, 0.23, 0.15)
    box(iron, 0, TRACK_TOP, RAIL_Z + side * 1.02, 360, 0.09, 0.23)
  }
  for (let x = -179; x <= 179; x += 1.35) box(timber, x, RAIL_HEIGHT + 0.065, RAIL_Z, 0.28, 0.2, 3.05)

  for (const side of [-1, 1]) {
    const mouth = side * RAIL_PORTAL_X, cap = side * 162
    const floor = RAIL_HEIGHT - 0.5, spring = RAIL_HEIGHT + 4.4, radius = 3.9
    // Local XY shape is turned so its opening faces along the track.
    const portal = new THREE.Shape().moveTo(-7.8, floor - 7).lineTo(7.8, floor - 7)
      .lineTo(7.8, spring + radius + 3).lineTo(-7.8, spring + radius + 3).closePath()
    const opening = new THREE.Path().moveTo(-radius, floor - 7).lineTo(-radius, spring)
    opening.absarc(0, spring, radius, Math.PI, 0, true)
    opening.lineTo(radius, floor - 7).closePath()
    portal.holes.push(opening)
    const geometry = new THREE.ExtrudeGeometry(portal, { depth: 2.8, bevelEnabled: false, curveSegments: 16 })
    geometry.rotateY(side * Math.PI / 2).translate(mouth, 0, RAIL_Z)
    add(stone, geometry, '#929481')
    // The short unlit sleeve ends before the rising terrain intersects the train.
    box(darkness, cap, RAIL_HEIGHT + 3.8, RAIL_Z, 0.3, 8.8, 7.8)
    for (const edge of [-1, 1]) {
      box(darkness, side * 157, RAIL_HEIGHT + 3.4, RAIL_Z + edge * 3.87, 10, 8, 0.18)
      const base = Math.min(getTerrainHeight(mouth, RAIL_Z + edge * 6), floor - 5)
      box(stone, mouth + side * 2, (base + spring) / 2, RAIL_Z + edge * 6.1, 8, spring - base, 4.2, '#8e927c')
      box(stone, mouth - side * 0.18, RAIL_HEIGHT + 2.2, RAIL_Z + edge * 4.34, 0.56, 5.4, 1.05, '#c0baa0')
    }
    box(darkness, side * 157, spring + radius - 0.1, RAIL_Z, 10, 0.25, 7.8)
    for (let j = 0; j < 15; j++) {
      const angle = (j + 0.5) / 15 * Math.PI
      const block = new THREE.BoxGeometry(0.55, 0.98, 0.95)
      block.rotateX(angle - Math.PI / 2)
      block.translate(mouth - side * 0.2, spring + Math.sin(angle) * 4.37, RAIL_Z + Math.cos(angle) * 4.37)
      add(stone, block, j % 3 === 0 ? '#c9c2a5' : '#b6b098')
    }
    // Low, irregular stone shoulders anchor each tunnel into its existing hill.
    for (let i = 0; i < 4; i++) for (const flank of [-1, 1]) {
      const x = side * (156 + i * 7), z = RAIL_Z + flank * (8.4 + i * 0.6)
      const ground = getTerrainHeight(x, z)
      const rock = new THREE.DodecahedronGeometry(1, 0)
      rock.scale(7.8, 5.2 + i * 0.4, 6.6).rotateY(i * 0.9 + side)
        .translate(x, Math.max(ground + 1, RAIL_HEIGHT + 4 - i), z)
      add(stone, rock, i % 2 ? '#858b76' : '#969b84')
    }
    // Crown becomes buried by the real slope, with the opening kept hollow below.
    box(stone, side * 164, spring + radius + 1.25, RAIL_Z, 23, 3, 14.7, '#929781')
  }
  return [stone, gravel, timber, iron, darkness].map(parts => {
    const result = mergeGeometries(parts)!
    parts.forEach(part => part.dispose())
    result.computeBoundingSphere()
    return result
  })
}

function ValleyTrain() {
  const engine = useGLTF(locomotiveUrl), carriage = useGLTF(carriageUrl)
  const cars = useMemo(() => [engine.scene, carriage.scene, carriage.scene, carriage.scene].map(source => {
    const model = source.clone(true)
    const baseY = new THREE.Box3().setFromObject(model).min.y
    model.position.y = -baseY
    const wheels: THREE.Object3D[] = []
    model.traverse(object => {
      if (object.name.startsWith('wheel')) wheels.push(object)
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = true
      object.receiveShadow = true
      const color = (material: THREE.Material) => {
        const copy = material.clone() as THREE.MeshStandardMaterial
        copy.color.set('#f6dbbb')
        copy.roughness = 0.86
        copy.metalness = 0.05
        return copy
      }
      object.material = Array.isArray(object.material) ? object.material.map(color) : color(object.material)
    })
    const group = new THREE.Group()
    group.scale.setScalar(TRAIN_SCALE)
    group.add(model)
    return { group, wheels }
  }), [engine.scene, carriage.scene])
  const elapsed = useRef(31)
  const smoke = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useFrame((_, frameDelta) => {
    const delta = Math.min(frameDelta, 0.1)
    elapsed.current += delta
    const state = sampleTrain(elapsed.current)
    cars.forEach(({ group, wheels }, i) => {
      group.position.set(state.x - i * RAIL_CAR_SPACING * state.direction, TRACK_TOP + 0.045, RAIL_Z)
      group.rotation.y = state.direction * Math.PI / 2
      if (state.moving) wheels.forEach(wheel => { wheel.rotation.x += delta * RAIL_SPEED / 0.57 })
    })
    if (!smoke.current) return
    for (let i = 0; i < 12; i++) {
      const age = (elapsed.current + i * 0.51) % 6.12
      const earlier = sampleTrain(elapsed.current - age)
      const visible = earlier.moving && Math.abs(earlier.x) < RAIL_PORTAL_X - 1
      dummy.position.set(earlier.x + earlier.direction * 1.9 + age * 0.48,
        TRACK_TOP + 3.6 + age * 0.7, RAIL_Z + age * 0.35)
      dummy.scale.setScalar(visible ? (0.22 + age * 0.2) * Math.min(1, (6.12 - age) / 1.8) : 0)
      dummy.updateMatrix()
      smoke.current.setMatrixAt(i, dummy.matrix)
    }
    smoke.current.instanceMatrix.needsUpdate = true
  })
  useEffect(() => () => cars.forEach(({ group }) => group.traverse(object => {
    if (object instanceof THREE.Mesh) {
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach(material => material.dispose())
    }
  })), [cars])
  return <group>
    {cars.map(({ group }, i) => <primitive key={i} object={group} />)}
    <instancedMesh ref={smoke} args={[undefined, undefined, 12]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial color="#e8e6d7" transparent opacity={0.21} depthWrite={false} />
    </instancedMesh>
  </group>
}

export default function Railway() {
  const [stone, gravel, timber, iron, darkness] = useMemo(buildRailway, [])
  useEffect(() => () => [stone, gravel, timber, iron, darkness].forEach(geometry => geometry.dispose()),
    [stone, gravel, timber, iron, darkness])
  return <group>
    <mesh geometry={stone} userData={{ solid: true }} castShadow receiveShadow><SurfaceMaterial strength={0.25} masonry /></mesh>
    <mesh geometry={gravel} receiveShadow><SurfaceMaterial color="#746f5c" vertexColors={false} strength={0.5} /></mesh>
    <mesh geometry={timber} receiveShadow><meshStandardMaterial color="#6c5944" roughness={1} /></mesh>
    <mesh geometry={iron} receiveShadow><meshStandardMaterial color="#777e77" metalness={0.55} roughness={0.47} /></mesh>
    <mesh geometry={darkness}><meshBasicMaterial color="#141e1d" side={THREE.DoubleSide} /></mesh>
    <ValleyTrain />
  </group>
}
