import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { collisionsReady } from '../utils/collision'
import { mulberry32 } from '../utils/noise'
import { getSurfaceHeight } from '../utils/terrain'
import { animalCanStand, animalGroundPoint, animalRoute, BEE_GARDENS, WILDLIFE_SITES, WILDLIFE_SPECIES, type WildlifeSpecies } from '../utils/wildlife'

const SPECIES = Object.keys(WILDLIFE_SPECIES) as WildlifeSpecies[]
const URLS = SPECIES.map(name => `/assets/wildlife/animal-${name}.glb`)
const UP = new THREE.Vector3(0, 1, 0)

export default function Wildlife() {
  const assets = useGLTF(URLS)
  const wildlife = useMemo(() => {
    const group = new THREE.Group()
    // The pack has no skins: transform clones retain shared geometry and one atlas material.
    let sharedMaterial: THREE.Material | THREE.Material[]
    assets[0].scene.traverse(object => {
      if ((object as THREE.Mesh).isMesh) sharedMaterial ??= (object as THREE.Mesh).material
    })
    const sites = [...WILDLIFE_SITES, ...BEE_GARDENS.map(([x, z]) => ({ species: 'bee' as const, x, z, range: .65 }))]
    const animals = sites.map((site, index) => {
      const asset = assets[SPECIES.indexOf(site.species)]
      const model = asset.scene.clone(true), root = new THREE.Group()
      root.name = `wildlife:${site.species}:${index}`
      model.traverse(object => {
        if (!(object as THREE.Mesh).isMesh) return
        const mesh = object as THREE.Mesh
        mesh.material = sharedMaterial
        mesh.castShadow = site.species !== 'bee'
        mesh.receiveShadow = true
      })
      model.scale.setScalar(WILDLIFE_SPECIES[site.species].height / WILDLIFE_SPECIES[site.species].rawHeight)
      root.add(model); group.add(root); root.visible = false
      const mixer = new THREE.AnimationMixer(model)
      const actions = Object.fromEntries(['idle', 'walk', 'eat'].map(name => [name, mixer.clipAction(asset.animations.find(clip => clip.name === name)!)]))
      const random = mulberry32(4109 + index * 173)
      actions.idle.play().time = random()
      actions.idle.timeScale = .65
      const wings = ['wing-left', 'wing-right'].map(name => model.getObjectByName(name))
      const wingRest = wings.map(wing => wing?.rotation.z ?? 0)
      return { ...site, root, mixer, actions, random, wings, wingRest,
        ready: false, home: new THREE.Vector3(), route: [] as THREE.Vector3[], segment: 1, progress: 0,
        pause: 2 + random() * 5, clip: 'idle', phase: random() * Math.PI * 2,
        heading: random() * Math.PI * 2, time: 0, groundTime: 0, tilt: new THREE.Quaternion(),
      }
    })
    return { group, animals }
  }, [assets])

  const scratch = useMemo(() => ({ normal: new THREE.Vector3(), rotation: new THREE.Quaternion(), heading: new THREE.Quaternion() }), [])
  useFrame(({ camera }, delta) => {
    if (!collisionsReady()) return
    const dt = Math.min(delta, .05)
    for (const animal of wildlife.animals) {
      const { root, species, random } = animal
      const bee = species === 'bee'
      if (!animal.ready) {
        // Validate after scene collision registration; never start inside a prop or trunk.
        let x = animal.x, z = animal.z, valid = bee || animalCanStand(x, z, species)
        for (let i = 0; !valid && i < 36; i++) {
          const angle = i * 2.399963, radius = Math.sqrt((i + 1) / 36) * animal.range
          x = animal.x + Math.cos(angle) * radius; z = animal.z + Math.sin(angle) * radius
          valid = animalCanStand(x, z, species)
        }
        if (!valid) continue
        animal.home.copy(animalGroundPoint(x, z)); root.position.copy(animal.home)
        animal.ready = true
      }
      root.visible = camera.position.distanceToSquared(root.position) < (bee ? 28 : 85) ** 2
      if (!root.visible) continue // No mixers, terrain queries or movement for distant wildlife.
      animal.time += dt
      let clip = 'idle'
      if (bee) {
        const t = animal.time, phase = animal.phase
        root.position.set(animal.home.x + Math.sin(t * .63 + phase) * .55,
          animal.home.y + .48 + Math.sin(t * 1.4 + phase) * .12,
          animal.home.z + Math.sin(t * .47 + phase * 2) * .4)
        root.rotation.set(Math.sin(t * 1.2 + phase) * .08, t * .35 + phase, Math.cos(t * .8) * .08)
      } else if (animal.route.length) {
        clip = 'walk'
        const a = animal.route[animal.segment - 1], b = animal.route[animal.segment]
        animal.progress += dt * WILDLIFE_SPECIES[species].speed / a.distanceTo(b)
        root.position.lerpVectors(a, b, Math.min(1, animal.progress))
        const heading = Math.atan2(b.x - a.x, b.z - a.z)
        animal.heading += Math.atan2(Math.sin(heading - animal.heading), Math.cos(heading - animal.heading)) * Math.min(1, dt * 3)
        if (animal.progress >= 1) {
          animal.progress -= 1; animal.segment++
          if (animal.segment === animal.route.length) { animal.route = []; animal.pause = 4 + random() * 8 }
        }
      } else {
        animal.pause -= dt
        clip = animal.pause > 2 && (species === 'cow' || species === 'deer' || species === 'bunny' || species === 'chick') ? 'eat' : 'idle'
        if (animal.pause <= 0) {
          for (let attempt = 0; attempt < 10; attempt++) {
            const angle = random() * Math.PI * 2, distance = .6 + random() * 1.7
            const x = root.position.x + Math.cos(angle) * distance, z = root.position.z + Math.sin(angle) * distance
            if (Math.hypot(x - animal.home.x, z - animal.home.z) > animal.range) continue
            const route = animalRoute(root.position, x, z, species)
            if (route) { animal.route = route; animal.segment = 1; animal.progress = 0; break }
          }
          animal.pause = 4 + random() * 6
        }
      }
      if (!bee) {
        // Align the feet to the visible terrain; sample only nearby animals at 5Hz.
        animal.groundTime -= dt
        if (animal.groundTime <= 0) {
          animal.groundTime = .2
          const { x, z } = root.position, d = Math.max(.15, WILDLIFE_SPECIES[species].radius * .7)
          scratch.normal.set(getSurfaceHeight(x - d, z) - getSurfaceHeight(x + d, z), 2 * d,
            getSurfaceHeight(x, z - d) - getSurfaceHeight(x, z + d)).normalize()
          animal.tilt.setFromUnitVectors(UP, scratch.normal)
        }
        const glance = clip === 'idle' ? Math.sin(animal.time * .42 + animal.phase) * .14 : 0
        scratch.heading.setFromAxisAngle(UP, animal.heading + glance)
        scratch.rotation.copy(animal.tilt).multiply(scratch.heading)
        root.quaternion.slerp(scratch.rotation, Math.min(1, dt * 5))
      }
      if (clip !== animal.clip) {
        animal.actions[animal.clip].fadeOut(.4)
        animal.actions[clip].reset().fadeIn(.4).play()
        animal.actions[clip].timeScale = clip === 'eat' ? .38 : clip === 'walk' ? .6 : .65
        animal.clip = clip
      }
      animal.mixer.update(dt)
      if (bee) animal.wings.forEach((wing, i) => {
        if (wing) wing.rotation.z = animal.wingRest[i] + Math.sin(animal.time * 75 + animal.phase) * (i ? -.48 : .48)
      })
    }
  })
  useEffect(() => {
    wildlife.animals.forEach(animal => animal.actions[animal.clip].play())
    // Keep the reusable action bindings valid through React's development effect replay.
    // The whole mixer is collected with its model on actual unmount.
    return () => wildlife.animals.forEach(animal => animal.mixer.stopAllAction())
  }, [wildlife])
  return <primitive object={wildlife.group} dispose={null} />
}

useGLTF.preload(URLS)
