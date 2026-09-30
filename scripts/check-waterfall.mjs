// Run with: node scripts/check-waterfall.mjs
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { buildSync } from 'esbuild'
import * as THREE from 'three'

const require = createRequire(import.meta.url), module = { exports: {} }
const { outputFiles } = buildSync({ entryPoints: ['src/utils/terrain.ts'], bundle: true,
  platform: 'node', format: 'cjs', external: ['three'], write: false })
new Function('require', 'module', 'exports', outputFiles[0].text)(require, module, module.exports)
const { riverX, riverHalfWidth, riverLevel, getSurfaceHeight,
  buildTerrainGeometry, WATERFALL_TERRAIN } = module.exports

let samples = 0, minimumBank = Infinity
// Check the rendered surface, including coarse river chunks: the water's
// highest animated edge is level + .075 + .025, and must meet real ground.
for (let z = -306; z <= 288; z += .25) for (const side of [-1, 1]) {
  const x = riverX(z) + side * riverHalfWidth(z)
  const clearance = getSurfaceHeight(x, z) - riverLevel(z)
  assert(clearance > .1, `Exposed water edge at (${x}, ${z}): bank ${clearance}m above level`)
  minimumBank = Math.min(minimumBank, clearance)
  samples++
}
// The sheet still has a continuous submerged bed over the crest, falling face
// and basin; a raised covering object must not replace the water corridor.
for (let z = -210; z <= -150; z += .15) {
  const depth = riverLevel(z) - getSurfaceHeight(riverX(z), z)
  assert(depth > 1.7 && depth < 2.1, `Broken waterfall bed at z=${z}: ${depth}m deep`)
}

const { x, z, segments } = WATERFALL_TERRAIN
const geometry = buildTerrainGeometry(80, 75, segments, z, x)
const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
mesh.position.set(x, 0, z)
mesh.updateMatrixWorld()
const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0)
for (const pz of [-224.9, -210.3, -182.1, -178.2, -174.4, -170.7, -150.1]) {
  for (const px of [riverX(pz), riverX(pz) - riverHalfWidth(pz), riverX(pz) + riverHalfWidth(pz)]) {
    ray.set(new THREE.Vector3(px, 300, pz), down)
    const hit = ray.intersectObject(mesh)[0]
    assert(hit && Math.abs(hit.point.y - getSurfaceHeight(px, pz)) < .00001,
      `Ground query differs from actual waterfall triangles at (${px}, ${pz})`)
  }
}
geometry.dispose()
mesh.material.dispose()
console.log(`PASS: ${samples} river bank samples support animated water (minimum ${minimumBank.toFixed(3)}m); continuous waterfall bed; rendered lip/bank triangles match ground queries`)
