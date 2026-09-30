import { useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { buildSolidCollisions, clearSolidCollisions } from '../utils/collision'

export default function SolidCollisions() {
  const scene = useThree(state => state.scene)
  useLayoutEffect(() => {
    const counts = buildSolidCollisions(scene)
    if (import.meta.env.DEV) console.info('SOLACE collisions', JSON.stringify(counts))
    return clearSolidCollisions
  }, [scene])
  return null
}
