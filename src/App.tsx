import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Scene from './components/Scene'
import IntroUI from './components/IntroUI'
import LoadingScreen from './components/LoadingScreen'

export default function App() {
  return (
    <>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        camera={{ fov: 62, near: 0.1, far: 2600, position: [-95.53, 55.04, 226.01] }}
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
