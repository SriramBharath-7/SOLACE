import { useFrame } from '@react-three/fiber'
import Terrain from './Terrain'
import Water from './Water'
import Bridge from './Bridge'
import Vegetation from './Vegetation'
import DistantMountains from './DistantMountains'
import SkyAndLight from './SkyAndLight'
import Explorer from './Explorer'
import CameraRig from './CameraRig'
import WorldDetails from './WorldDetails'
import { tickWind } from '../utils/wind'

function WindTicker() {
  useFrame((state) => tickWind(state.clock.elapsedTime))
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

      <Explorer />
      <CameraRig />
      <WindTicker />
    </>
  )
}
