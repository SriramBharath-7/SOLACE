import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { getTerrainHeight, riverHalfWidth, riverLevel, riverX } from '../utils/terrain'
import { distanceToPath, pathCurve } from '../utils/path'
import { mulberry32 } from '../utils/noise'

interface Outcrop { x: number; z: number; width: number; height: number; depth: number; yaw: number; base?: number }

/** Broken, leaning stone strata with distinct moss-covered crown faces. */
function stoneGeometry(seed: number) {
  const random = mulberry32(seed)
  const sides = 7
  const rings: THREE.Vector3[][] = []
  const radii = Array.from({ length: sides }, () => 0.78 + random() * 0.35)
  for (let ring = 0; ring < 3; ring++) {
    rings.push(Array.from({ length: sides }, (_, i) => {
      const angle = i / sides * Math.PI * 2
      const taper = [1, 0.97, 0.69][ring]
      return new THREE.Vector3(
        Math.cos(angle) * radii[i] * taper * 0.5 + ring * 0.055,
        [0, 0.57, 0.91][ring] + (ring ? random() * 0.09 : 0),
        Math.sin(angle) * radii[i] * taper * 0.5 - ring * 0.03,
      )
    }))
  }
  const positions: number[] = [], colors: number[] = []
  const stone = new THREE.Color('#929489'), moss = new THREE.Color('#70834b')
  function face(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, top = false) {
    const color = (top ? moss : stone).clone().multiplyScalar(0.87 + random() * 0.22)
    for (const v of [a, b, c]) {
      positions.push(v.x, v.y, v.z)
      colors.push(color.r, color.g, color.b)
    }
  }
  for (let ring = 0; ring < 2; ring++) for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides
    face(rings[ring][i], rings[ring + 1][i], rings[ring][j])
    face(rings[ring][j], rings[ring + 1][i], rings[ring + 1][j])
  }
  const crown = new THREE.Vector3(0.1, 1.02, -0.06)
  for (let i = 0; i < sides; i++) face(rings[2][i], crown, rings[2][(i + 1) % sides], true)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

function buildOutcrops() {
  const authored: Outcrop[] = [
    // Origin: framing at the sides and behind, with the north-east vista open.
    { x: -121, z: 216, width: 14, height: 17, depth: 9, yaw: 0.4 },
    { x: -117, z: 226, width: 8, height: 10, depth: 11, yaw: -0.6 },
    { x: -110, z: 241, width: 15, height: 9, depth: 10, yaw: 0.8 },
    { x: -75, z: 234, width: 11, height: 10, depth: 7, yaw: -0.4 },
    { x: -78, z: 226, width: 5, height: 5, depth: 5, yaw: 0.2 },
    // Summit shoulders leave its flat arrival and future lone-tree site clear.
    { x: 83, z: -335, width: 12, height: 22, depth: 16, yaw: -0.2 },
    { x: 84, z: -353, width: 9, height: 17, depth: 12, yaw: 0.6 },
    { x: 118, z: -319, width: 14, height: 22, depth: 10, yaw: 0.2 },
    { x: 136, z: -330, width: 15, height: 25, depth: 14, yaw: -0.3 },
    { x: 140, z: -317, width: 11, height: 19, depth: 12, yaw: -0.5 },
    // Visible crags establish the scale of the eastern mountain shoulder.
    { x: 218, z: -254, width: 18, height: 29, depth: 22, yaw: 0.3 },
    { x: 222, z: -281, width: 13, height: 34, depth: 19, yaw: -0.4 },
    { x: -155, z: -177, width: 21, height: 20, depth: 16, yaw: 0.7 },
    { x: -164, z: -158, width: 16, height: 24, depth: 12, yaw: -0.1 },
  ]
  // Waterfall rock walls descend into the lower basin. The full water corridor
  // stays open; these establish geology rather than a finished waterfall effect.
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
    const z = -183 + i * 4.8
    const x = riverX(z) + side * (riverHalfWidth(z) + 7 + Math.sin(i * 1.9) * 2.5)
    const base = riverLevel(-157) - 4
    const rim = Math.max(getTerrainHeight(x, z) + 3, riverLevel(-185) + 3 - i * 1.8)
    authored.push({ x, z, width: 12 + i % 2 * 3, height: rim - base, depth: 9.5, yaw: side * 0.12 + i * 0.16, base })
  }
  // A natural constriction for the future railway viaduct: rock abutments only.
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const z = -65 + (i - 1) * 9
    const x = riverX(z) + side * (riverHalfWidth(z) + 10 + (i === 1 ? 0 : 5))
    authored.push({ x, z, width: i === 1 ? 17 : 12, height: i === 1 ? 19 : 12, depth: 14, yaw: side * 0.45 + i * 0.18 })
  }
  // Break each main mass with a few smaller irregular talus slabs at its foot.
  const random = mulberry32(603)
  const talus: Outcrop[] = authored.slice(0, 14).flatMap((rock) => Array.from({ length: 2 }, () => ({
    x: rock.x + (random() - 0.5) * rock.width * 1.2,
    z: rock.z + (random() - 0.5) * rock.depth * 1.3,
    width: 2.8 + random() * 3.7, height: 2.8 + random() * 4,
    depth: 2.6 + random() * 3.4, yaw: random() * Math.PI,
  })))
  const shapes = [stoneGeometry(21), stoneGeometry(43), stoneGeometry(81)]
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const geometryParts = [...authored, ...talus]
    .filter(rock => distanceToPath(rock.x, rock.z) > Math.max(rock.width, rock.depth) * 0.62 + 3.4)
    .map((rock, i) => {
      const base = rock.base ?? getTerrainHeight(rock.x, rock.z) - rock.height * 0.49
      matrix.compose(new THREE.Vector3(rock.x, base, rock.z),
        quaternion.setFromAxisAngle(up, rock.yaw), new THREE.Vector3(rock.width, rock.height, rock.depth))
      return shapes[i % shapes.length].clone().applyMatrix4(matrix)
    })
  const merged = mergeGeometries(geometryParts)!
  geometryParts.forEach(geometry => geometry.dispose())
  shapes.forEach(geometry => geometry.dispose())
  return merged
}

export default function WorldDetails() {
  const rocks = useMemo(buildOutcrops, [])
  const markers = useMemo(() => [0.035, 0.14, 0.25, 0.34, 0.43, 0.54, 0.69, 0.82, 0.94].map(t => {
    const p = pathCurve.getPointAt(t), tangent = pathCurve.getTangentAt(t)
    const x = p.x - tangent.z * 3.1, z = p.z + tangent.x * 3.1
    return new THREE.Vector3(x, getTerrainHeight(x, z), z)
  }), [])
  const fence = useMemo(() => [-1, 0, 1].map(i => {
    const x = -84 - i * 0.7, z = 216 + i * 3.2
    return new THREE.Vector3(x, getTerrainHeight(x, z), z)
  }), [])
  useEffect(() => () => rocks.dispose(), [rocks])
  return (
    <group>
      <mesh geometry={rocks} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      {markers.map((p, i) => <group key={i} position={p} rotation={[0, i * 1.7, 0]}>
        <mesh position={[0, 0.69, 0]} castShadow>
          <boxGeometry args={[0.18, 1.38, 0.18]} /><meshStandardMaterial color="#685c44" roughness={1} />
        </mesh>
        <mesh position={[0, 1.25, 0]} castShadow>
          <boxGeometry args={[0.2, 0.19, 0.2]} /><meshStandardMaterial color="#d7c7a4" roughness={1} />
        </mesh>
      </group>)}
      {fence.map((p, i) => <mesh key={i} position={[p.x, p.y + 0.65, p.z]} castShadow>
        <boxGeometry args={[0.22, 1.4, 0.24]} /><meshStandardMaterial color="#796544" roughness={1} />
      </mesh>)}
      {fence.slice(1).map((p, i) => {
        const a = fence[i].clone().add(new THREE.Vector3(0, 1.02, 0))
        const b = p.clone().add(new THREE.Vector3(0, 1.02, 0))
        const direction = b.clone().sub(a)
        return <mesh key={i} position={a.add(b).multiplyScalar(0.5)}
          quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())} castShadow>
          <boxGeometry args={[0.13, direction.length(), 0.13]} /><meshStandardMaterial color="#a78b5c" roughness={1} />
        </mesh>
      })}
    </group>
  )
}

