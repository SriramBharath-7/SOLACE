import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useMouseOrbit } from '../hooks/useMouseOrbit'
import { playerState } from '../utils/playerState'
import { getTerrainHeight } from '../utils/terrain'
import { CAMERA } from '../constants'

export default function CameraRig() {
  const { camera, gl } = useThree()
  const orbit = useMouseOrbit(gl.domElement)
  const targetPosition = useRef(new THREE.Vector3())
  const lookTarget = useRef(new THREE.Vector3())

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const { yaw, pitch } = orbit.current
    const anchor = playerState.position
    // The reference follows a drone's center; follow the human's torso.
    const anchorY = anchor.y + 0.8

    // SOLACE_CAM_EXACT.html: fixed horizontal radius, linear pitch offset,
    // weighted position and a live (undamped) look-at target.
    targetPosition.current.set(
      anchor.x + Math.sin(yaw) * CAMERA.distance,
      anchorY + CAMERA.height + pitch * 3,
      anchor.z + Math.cos(yaw) * CAMERA.distance,
    )
    targetPosition.current.y = Math.max(
      targetPosition.current.y,
      getTerrainHeight(targetPosition.current.x, targetPosition.current.z) + 0.65,
    )
    camera.position.lerp(targetPosition.current, Math.min(1, CAMERA.positionDamping * dt))
    camera.position.y = Math.max(camera.position.y, getTerrainHeight(camera.position.x, camera.position.z) + 0.65)
    lookTarget.current.set(anchor.x, anchorY + 0.4 - pitch * 2, anchor.z)
    camera.lookAt(lookTarget.current)
  })

  return null
}
