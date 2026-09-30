// Run with node scripts/check-wildlife.mjs. Uses the shipped assets and route code.
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import ts from 'typescript'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const require = createRequire(import.meta.url), cache = new Map(), overrides = new Map()
function source(filename) {
  const path = resolve(/\.tsx?$/.test(filename) ? filename : `${filename}.ts`)
  if (cache.has(path)) return cache.get(path).exports
  const module = { exports: {} }; cache.set(path, module)
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } })
  new Function('require', 'module', 'exports', outputText)(name => overrides.get(name) ?? (name === 'three' ? THREE : name.startsWith('.') ? source(resolve(dirname(path), name)) : require(name)), module, module.exports)
  return module.exports
}
const { WILDLIFE_SPECIES, WILDLIFE_SITES, BEE_GARDENS, animalCanStand, animalGroundPoint, animalRoute } = source('src/utils/wildlife.ts')
const { buildSolidCollisions } = source('src/utils/collision.ts')
for (const [name, spec] of Object.entries(WILDLIFE_SPECIES)) {
  const path = `public/assets/wildlife/animal-${name}.glb`, buffer = readFileSync(path)
  const gltf = JSON.parse(buffer.toString('utf8', 20, 20 + buffer.readUInt32LE(12)))
  assert.equal(gltf.skins?.length ?? 0, 0, 'Transform clones require unskinned Cube Pets')
  const bounds = new THREE.Box3()
  function visit(index, parent) {
    const node = gltf.nodes[index]
    const matrix = node.matrix ? new THREE.Matrix4().fromArray(node.matrix) : new THREE.Matrix4().compose(
      new THREE.Vector3(...(node.translation ?? [0, 0, 0])), new THREE.Quaternion(...(node.rotation ?? [0, 0, 0, 1])), new THREE.Vector3(...(node.scale ?? [1, 1, 1])))
    matrix.premultiply(parent)
    if (node.mesh !== undefined) for (const primitive of gltf.meshes[node.mesh].primitives) {
      const position = gltf.accessors[primitive.attributes.POSITION]
      bounds.union(new THREE.Box3(new THREE.Vector3(...position.min), new THREE.Vector3(...position.max)).applyMatrix4(matrix))
    }
    for (const child of node.children ?? []) visit(child, matrix)
  }
  for (const root of gltf.scenes[gltf.scene ?? 0].nodes) visit(root, new THREE.Matrix4())
  assert(Math.abs(bounds.getSize(new THREE.Vector3()).y - spec.rawHeight) < .001, `${name} scale no longer matches its model`)
  for (const clip of ['idle', 'walk', 'eat']) {
    const animation = gltf.animations.find(animation => animation.name === clip)
    assert(animation?.channels.length, `${name}: missing native ${clip} animation`)
    const translation = animation.channels.find(channel => gltf.nodes[channel.target.node].name === 'root' && channel.target.path === 'translation')
    const positions = gltf.accessors[animation.samplers[translation.sampler].output]
    assert.equal(positions.max[0] - positions.min[0], 0, `${name} root motion escapes its local X route`)
    assert.equal(positions.max[2] - positions.min[2], 0, `${name} root motion escapes its local Z route`)
  }
  for (const image of gltf.images ?? []) if (image.uri) assert(existsSync(resolve(dirname(path), image.uri)), `${name}: missing atlas`)
  console.log(`${name}: ${(spec.height * 100).toFixed(0)}cm tall; native idle/walk/eat verified`)
}
assert(WILDLIFE_SPECIES.bee.height < WILDLIFE_SPECIES.chick.height && WILDLIFE_SPECIES.chick.height < WILDLIFE_SPECIES.cat.height && WILDLIFE_SPECIES.cat.height < WILDLIFE_SPECIES.cow.height)
assert(WILDLIFE_SITES.length <= 12 && BEE_GARDENS.length <= 10, 'Ambient population expanded unexpectedly')

buildSolidCollisions(new THREE.Group())
for (const site of WILDLIFE_SITES) {
  assert(animalCanStand(site.x, site.z, site.species), `${site.species} habitat starts on unsafe terrain`)
  let routes = 0
  const start = animalGroundPoint(site.x, site.z)
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
    const route = animalRoute(start, site.x + Math.cos(angle) * .6, site.z + Math.sin(angle) * .6, site.species)
    if (route) { routes++; assert(route.every(p => animalCanStand(p.x, p.z, site.species))) }
  }
  assert(routes > 0, `${site.species} has no safe short route`)
}
// A narrow fence must stop small animals, even when both route endpoints are clear.
const from = animalGroundPoint(-56, 4), to = animalGroundPoint(-54, 4)
const fence = new THREE.Mesh(new THREE.BoxGeometry(.08, 1.2, 3))
fence.position.set(-55, from.y + .6, 4); fence.userData.solid = true
buildSolidCollisions(fence)
assert(!animalRoute(from, to.x, to.z, 'chick'), 'A chick route passed through a thin fence')
buildSolidCollisions(new THREE.Group())
assert(animalRoute(from, to.x, to.z, 'chick'), 'Clear settlement lane incorrectly rejects walking')
assert(!animalRoute(animalGroundPoint(24, -118), 8, -118, 'beaver'), 'Beaver route entered the river')
console.log('PASS: measured species scales, native clips, 10 viable habitats, thin-fence and river route rejection')

// Exercise the real component, native clips and React's setup/cleanup/setup lifecycle.
// Only atlas loading is omitted: it requires a browser and doesn't affect animation.
globalThis.ProgressEvent ??= class ProgressEvent extends Event {
  constructor(type, init) { super(type); Object.assign(this, init) }
}
const assets = await Promise.all(Object.keys(WILDLIFE_SPECIES).map(async name => {
  const buffer = readFileSync(`public/assets/wildlife/animal-${name}.glb`), jsonLength = buffer.readUInt32LE(12)
  const gltf = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength))
  gltf.buffers[0].uri = `data:application/octet-stream;base64,${buffer.subarray(28 + jsonLength).toString('base64')}`
  for (const material of gltf.materials) delete material.pbrMetallicRoughness.baseColorTexture
  delete gltf.textures; delete gltf.images
  return new GLTFLoader().parseAsync(JSON.stringify(gltf), '')
}))
let frame
const effects = []
overrides.set('react', { useMemo: fn => fn(), useEffect: setup => effects.push(setup) })
overrides.set('@react-three/fiber', { useFrame: callback => { frame = callback } })
overrides.set('@react-three/drei', { useGLTF: Object.assign(() => assets, { preload: () => {} }) })
const Wildlife = source('src/components/Wildlife.tsx').default
const element = Wildlife(), animals = element.props.object.children
effects.map(setup => setup()).forEach(cleanup => cleanup?.())
const cleanups = effects.map(setup => setup())
const cat = animals.find(animal => animal.name.startsWith('wildlife:cat:'))
const camera = new THREE.PerspectiveCamera(); camera.position.copy(animalGroundPoint(-56, 4))
frame({ camera }, .05)
const idlePose = cat.getObjectByName('body').quaternion.clone()
for (let i = 0; i < 6; i++) frame({ camera }, .05)
assert(idlePose.angleTo(cat.getObjectByName('body').quaternion) > .001, 'Native idle animation did not restart after StrictMode cleanup')
const initialPosition = cat.position.clone()
let moved = false
for (let i = 0; i < 1200; i++) {
  frame({ camera }, .05)
  moved ||= cat.position.distanceTo(initialPosition) > .1
  assert(cat.position.distanceTo(initialPosition) < 4, 'Cat escaped its local settlement habitat')
}
assert(moved, 'Cat never entered its native walking phase')
const bee = animals.find(animal => animal.name.startsWith('wildlife:bee:'))
camera.position.copy(animalGroundPoint(-87, 215))
for (let i = 0; i < 1200; i++) {
  frame({ camera }, .05)
  for (const name of ['wing-left', 'wing-right']) assert(Math.abs(bee.getObjectByName(name).rotation.z) < Math.PI, 'Bee wing rotation accumulated across frames')
}
cleanups.forEach(cleanup => cleanup?.())
console.log('PASS: StrictMode native idle restart, 60s local wandering, 60s bounded bee wing movement')
