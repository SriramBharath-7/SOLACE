import { useMemo } from 'react'
import InstancedModel from './InstancedModel'
import { buildVegetationLayout, type LayoutKey } from '../utils/vegetationLayout'

const MODEL_URLS: Record<LayoutKey, string> = {
  pineTall: '/assets/models/tree-pine-tall.glb',
  pineRound: '/assets/models/tree-pine-round.glb',
  pineSmall: '/assets/models/tree-pine-small.glb',
  oak: '/assets/models/tree-oak.glb',
  rockLarge: '/assets/models/rock-large.glb',
  rockSmall: '/assets/models/rock-small.glb',
  rockSmallFlat: '/assets/models/rock-small-flat.glb',
  flowerPurple: '/assets/models/flower-purple.glb',
  flowerRed: '/assets/models/flower-red.glb',
  flowerYellow: '/assets/models/flower-yellow.glb',
  bushSmall: '/assets/models/bush-small.glb',
  bushDetailed: '/assets/models/bush-detailed.glb',
  bushLarge: '/assets/models/bush-large.glb',
  grassLarge: '/assets/models/grass-large.glb',
  grassLeafsLarge: '/assets/models/grass-leafs-large.glb',
}

const WIND_SPECIES = new Set<LayoutKey>([
  'pineTall',
  'pineRound',
  'pineSmall',
  'oak',
  'flowerPurple',
  'flowerRed',
  'flowerYellow',
  'bushSmall',
  'bushDetailed',
  'bushLarge',
  'grassLarge',
  'grassLeafsLarge',
])

export default function Vegetation() {
  const layout = useMemo(() => buildVegetationLayout(1337), [])

  return (
    <group>
      {(Object.keys(MODEL_URLS) as LayoutKey[]).map((key) => (
        <InstancedModel
          key={key}
          url={MODEL_URLS[key]}
          placements={layout[key]}
          wind={WIND_SPECIES.has(key)}
          castShadow={key.startsWith('pine') || key === 'oak' || key === 'rockLarge'}
        />
      ))}
    </group>
  )
}
