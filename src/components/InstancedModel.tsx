import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { applyWindSway } from '../utils/wind'
import type { Placement } from '../utils/vegetationLayout'

const NATURE_COLORS: Record<string, string> = {
  leafsGreen: '#628451', leafsDark: '#426754', grass: '#809350',
  woodBark: '#806448', woodBarkDark: '#655543', dirt: '#888876',
  stone: '#999887',
}

interface Props {
  url: string
  placements: Placement[]
  wind?: boolean
  castShadow?: boolean
}

export default function InstancedModel({ url, placements, wind = false, castShadow = true }: Props) {
  const { scene } = useGLTF(url)
  const groundCover = /\/(grass-|flower-|bush-)/.test(url)
  const group = useMemo(() => {
    scene.updateMatrixWorld(true)
    const baseY = new THREE.Box3().setFromObject(scene).min.y
    const result = new THREE.Group()
    if (placements.length === 0) return result
    const transform = new THREE.Object3D()
    const tint = new THREE.Color()
    // Spatial batches let Three cull the far side of the valley. Matrices are
    // populated once, with no React node or per-frame CPU update per plant.
    const batches = new Map<string, Placement[]>()
    for (const placement of placements) {
      const cell = `${Math.floor(placement.position[0] / (groundCover ? 40 : 120))},${Math.floor(placement.position[2] / (groundCover ? 40 : 120))}`
      const batch = batches.get(cell) ?? []
      batch.push(placement)
      batches.set(cell, batch)
    }
    scene.traverse((object) => {
      const source = object as THREE.Mesh
      if (!source.isMesh) return
      const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld)
      geometry.translate(0, -baseY, 0)
      const cloneMaterial = (original: THREE.Material) => {
        const material = original.clone()
        if (material instanceof THREE.MeshStandardMaterial) {
          // The nature kit exports nonmetal objects with metalness=1. Clone
          // only these materials; the explorer's textures remain untouched.
          material.metalness = 0
          material.roughness = 1
          const color = NATURE_COLORS[material.name]
          if (color) material.color.set(color)
        }
        if (wind) applyWindSway(material, { strength: 0.013, speed: 0.55, scale: 0.18 })
        return material
      }
      const material = Array.isArray(source.material) ? source.material.map(cloneMaterial) : cloneMaterial(source.material)
      for (const batch of batches.values()) {
        const mesh = new THREE.InstancedMesh(geometry, material, batch.length)
        // Bark primitives use their own indices; foliage shares the position buffer.
        const materials = Array.isArray(material) ? material : [material]
        mesh.userData.solid = /\/tree-(pine|oak)/.test(url)
          ? materials.some(m => m.name.startsWith('woodBark'))
          : /\/(rock-large|cart|workbench(?:-anvil)?|barrel|box(?:-open)?|resource-wood|chest|bedroll-frame|tree-log)\.glb$/.test(url)
        mesh.castShadow = castShadow
        mesh.receiveShadow = true
        batch.forEach((placement, i) => {
          transform.position.set(...placement.position)
          transform.rotation.set(0, placement.rotationY, 0)
          transform.scale.setScalar(placement.scale)
          transform.updateMatrix()
          mesh.setMatrixAt(i, transform.matrix)
          const variation = 0.89 + (Math.sin(placement.position[0] * 2.7 + placement.position[2] * 1.3) + 1) * 0.075
          mesh.setColorAt(i, tint.setRGB(variation, variation, variation))
        })
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
        mesh.computeBoundingSphere()
        result.add(mesh)
      }
    })
    return result
  }, [scene, placements, wind, castShadow, groundCover])

  // Low ground cover is sub-pixel beyond the nearby landscape; trees retain their full reach.
  useFrame(({camera}) => {
    if (!groundCover) return
    for (const object of group.children) {
      const mesh = object as THREE.InstancedMesh
      const bounds = mesh.boundingSphere!
      mesh.visible = camera.position.distanceToSquared(bounds.center) < (bounds.radius + 95) ** 2
    }
  })

  useEffect(() => () => {
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    group.traverse((object) => {
      if (!(object instanceof THREE.InstancedMesh)) return
      object.dispose()
      geometries.add(object.geometry)
      const list = Array.isArray(object.material) ? object.material : [object.material]
      list.forEach((material) => materials.add(material))
    })
    geometries.forEach((geometry) => geometry.dispose())
    materials.forEach((material) => material.dispose())
  }, [group])

  return <primitive object={group} />
}
