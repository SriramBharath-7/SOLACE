import { useEffect, useMemo } from 'react'
import { buildRidgeGeometry } from '../utils/ridge'

// Unequal, overlapping ranges close the valley in every direction and leave
// the reachable Horizon mountain readable against a much larger world.
const RANGES = [
  { x: -70, z: -1120, yaw: -0.06, width: 2400, depth: 620, height: 320, amplitude: 185, color: '#a9bdca', seed: 41 },
  { x: 60, z: -790, yaw: 0.07, width: 1800, depth: 490, height: 218, amplitude: 140, color: '#819eae', seed: 17 },
  { x: -535, z: -230, yaw: Math.PI / 2 + 0.05, width: 1450, depth: 500, height: 148, amplitude: 122, color: '#91a393', seed: 32 },
  { x: 540, z: -240, yaw: Math.PI / 2 - 0.06, width: 1550, depth: 500, height: 174, amplitude: 115, color: '#a6ac96', seed: 76 },
  { x: -80, z: 500, yaw: -0.08, width: 1750, depth: 510, height: 146, amplitude: 125, color: '#99a58b', seed: 58 },
] as const

function Range({ range }: { range: typeof RANGES[number] }) {
  const geometry = useMemo(() => buildRidgeGeometry(
    range.width, 112, range.height, range.amplitude, range.seed, range.depth,
  ), [range])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} position={[range.x, 0, range.z]} rotation={[0, range.yaw, 0]}>
      <meshStandardMaterial vertexColors color={range.color} roughness={1} flatShading />
    </mesh>
  )
}

export default function DistantMountains() {
  return <group>{RANGES.map((range) => <Range key={range.seed} range={range} />)}</group>
}

