import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Scene from './components/Scene'
import IntroUI from './components/IntroUI'
import LoadingScreen from './components/LoadingScreen'
import { playerState } from './utils/playerState'

export default function App() {
  const review = import.meta.env.DEV && new URLSearchParams(window.location.search).has('vista')
  const p = playerState.position
  const initialCamera: [number, number, number] = review
    ? [p.x + Math.sin(playerState.heading) * 6.2, p.y + 3.4, p.z + Math.cos(playerState.heading) * 6.2]
    : [-95.53, 55.04, 226.01]
  return (
    <>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        camera={{ fov: 62, near: 0.1, far: 2600, position: initialCamera }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <LoadingScreen />
      <IntroUI />
      <div className="solace-vignette" />
    </>
  )
}
