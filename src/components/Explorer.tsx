import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { useKeyboardControls } from '../hooks/useKeyboardControls'
import { playerState } from '../utils/playerState'
import { getGroundHeight, isWalkable } from '../utils/terrain'
import { gameplayInput } from '../hooks/useMouseOrbit'
import { PLAYER, WORLD } from '../constants'

const Y_AXIS = new THREE.Vector3(0, 1, 0)
const MODEL_URL = '/assets/models/character-gamer.glb'

type ClipName = 'idle' | 'walk' | 'sprint'

export default function Explorer() {
  const group = useRef<THREE.Group>(null)
  const modelYaw = useRef<THREE.Group>(null)
  const input = useKeyboardControls()
  const { scene, animations } = useGLTF(MODEL_URL)
  const { actions } = useAnimations(animations, scene)

  const velocity = useRef(new THREE.Vector3())
  const currentClip = useRef<ClipName>('idle')

  // character-gamer.glb genuinely ships 32 animation clips (confirmed by
  // inspecting the GLB's JSON chunk directly). We only need three of them
  // for Phase 1B: idle, walk, sprint — all present with real keyframe data.
  useEffect(() => {
    scene.traverse((object) => { if ((object as THREE.Mesh).isMesh) { object.castShadow = true; object.receiveShadow = true } })
    const idle = actions['idle']
    if (idle) idle.reset().fadeIn(0.25).play()
    return () => {
      Object.values(actions).forEach((a) => a?.stop())
    }
  }, [actions])

  function setClip(name: ClipName, timeScale = 1) {
    if (currentClip.current === name) {
      const active = actions[name]
      if (active) active.timeScale = timeScale
      return
    }
    const next = actions[name]
    const prev = actions[currentClip.current]
    if (next) {
      next.reset()
      next.timeScale = timeScale
      next.play()
      if (prev && prev !== next) next.crossFadeFrom(prev, 0.35, true)
    }
    currentClip.current = name
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)

    const { forward, backward, left, right, sprint } = input.current
    const az = playerState.cameraAzimuth

    const forwardDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(Y_AXIS, az)
    const rightDir = new THREE.Vector3(1, 0, 0).applyAxisAngle(Y_AXIS, az)

    const wish = new THREE.Vector3()
    if (forward) wish.add(forwardDir)
    if (backward) wish.sub(forwardDir)
    if (right) wish.add(rightDir)
    if (left) wish.sub(rightDir)

    const moving = wish.lengthSq() > 0.0001
    if (moving) wish.normalize()

    const maxSpeed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed
    const targetVel = wish.multiplyScalar(moving ? maxSpeed : 0)

    velocity.current.lerp(targetVel, Math.min(1, PLAYER.acceleration * dt))
    if (!moving) velocity.current.multiplyScalar(1 - Math.min(1, PLAYER.deceleration * dt))
    if (!gameplayInput.active) velocity.current.set(0, 0, 0)

    // Integrate position, clamped to the playable slice.
    const next = playerState.position.clone()
    // Axis-separated slope/river collision allows sliding along steep banks.
    const nextX = THREE.MathUtils.clamp(next.x + velocity.current.x * dt, -WORLD.halfWidth + 12, WORLD.halfWidth - 12)
    if (isWalkable(nextX, next.z) && Math.abs(getGroundHeight(nextX, next.z) - next.y) < 0.75) next.x = nextX
    else velocity.current.x = 0
    const nextZ = THREE.MathUtils.clamp(next.z + velocity.current.z * dt, WORLD.endZ + 12, WORLD.startZ - 12)
    if (isWalkable(next.x, nextZ) && Math.abs(getGroundHeight(next.x, nextZ) - getGroundHeight(next.x, next.z)) < 0.75) next.z = nextZ
    else velocity.current.z = 0
    next.y = getGroundHeight(next.x, next.z)
    playerState.position.copy(next)
    const speed = velocity.current.length()
    playerState.speed = speed

    if (velocity.current.lengthSq() > 0.02) {
      if (!playerState.hasMoved) playerState.hasMoved = true
      const targetHeading = Math.atan2(velocity.current.x, velocity.current.z) + Math.PI
      // Shortest-path angle interpolation.
      const diff = Math.atan2(Math.sin(targetHeading - playerState.heading), Math.cos(targetHeading - playerState.heading))
      playerState.heading += diff * Math.min(1, PLAYER.turnSpeed * dt)
    }

    // Idle / walk / sprint, driven by actual velocity so the gait always
    // matches how fast the explorer is really moving (not just key state).
    const walkRef = PLAYER.walkSpeed
    const sprintRef = PLAYER.sprintSpeed
    if (speed < 0.15) {
      setClip('idle')
    } else if (sprint && speed > walkRef * 0.6) {
      setClip('sprint', THREE.MathUtils.clamp(speed / sprintRef, 0.8, 1.25))
    } else {
      setClip('walk', THREE.MathUtils.clamp(speed / walkRef, 0.7, 1.3))
    }

    if (group.current) group.current.position.copy(playerState.position)
    // modelYawOffset corrects the model's local forward axis (+Z) to match
    // the -Z "into the journey" convention used by heading/forwardDir above
    // — see constants.ts. Movement math itself is untouched.
    if (modelYaw.current) modelYaw.current.rotation.y = playerState.heading + PLAYER.modelYawOffset
  })

  return (
    <group ref={group}>
      <group ref={modelYaw} scale={PLAYER.scale}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

useGLTF.preload(MODEL_URL)
