import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import HeroDetails from './HeroDetails'
import Terrain from './Terrain'
import Water from './Water'
import Bridge from './Bridge'
import Vegetation from './Vegetation'
import DistantMountains from './DistantMountains'
import SkyAndLight from './SkyAndLight'
import Explorer from './Explorer'
import CameraRig from './CameraRig'
import WorldDetails from './WorldDetails'
import Settlements from './Settlements'
import ExplorationRegions from './ExplorationRegions'
import Railway from './Railway'
import SolidCollisions from './SolidCollisions'
import Wildlife from './Wildlife'
import { tickWind } from '../utils/wind'

function WindTicker() {
  const frames = useRef(0)
  useFrame((state) => {
    tickWind(state.clock.elapsedTime)
    if (import.meta.env.DEV && ++frames.current === 12) {
      document.documentElement.dataset.worldReady = 'true'
      console.info('SOLACE render', JSON.stringify(state.gl.info.render))
    }
  })
  return null
}

export default function Scene() {
  return (
    <>
      <SkyAndLight />
      <DistantMountains />

      <Terrain />
      <Water />
      <Bridge />
      <Vegetation />
      <WorldDetails />
      <Settlements />
      <HeroDetails />
      <ExplorationRegions />
      <Railway />
      <Wildlife />
      <SolidCollisions />

      <Explorer />
      <CameraRig />
      <WindTicker />
    </>
  )
}
