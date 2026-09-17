// Run with: node scripts/check-world.mjs
// Loads the same TypeScript height/path functions used by the app, without a
// build directory or an extra test dependency.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const cache = new Map()
const moduleOverrides = new Map()
function loadSource(filename) {
  const path = resolve(root, /\.tsx?$/.test(filename) ? filename : `${filename}.ts`)
  if (cache.has(path)) return cache.get(path).exports
  const module = { exports: {} }
  cache.set(path, module)
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    fileName: path,
  })
  const localRequire = (name) => moduleOverrides.get(name)
    ?? (name.startsWith('.') ? loadSource(resolve(dirname(path), name)) : require(name))
  new Function('require', 'module', 'exports', outputText)(localRequire, module, module.exports)
  return module.exports
}

const { WORLD, PLAYER, LANDMARKS, PATH_CONTROL_POINTS } = loadSource('src/constants.ts')
const { samplePath, pathCurve, trailLength } = loadSource('src/utils/path.ts')
const { getTerrainHeight, getGroundHeight, isWalkable, onBridge, riverX, riverLevel,
  BRIDGE_X, BRIDGE_Y, BRIDGE_Z, BRIDGE_HALF_LENGTH } = loadSource('src/utils/terrain.ts')
const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }
const location = (point) => `(${point.x.toFixed(2)}, ${point.z.toFixed(2)})`

const steps = Math.ceil(trailLength / 0.35)
let previous, maxGrade = 0, worstGrade = samplePath(0), maxGroundError = 0, worstGround = samplePath(0)
const blocked = [], bridgeSamples = []
for (let i = 0; i <= steps; i++) {
  const point = samplePath(i / steps)
  const terrain = getTerrainHeight(point.x, point.z)
  const ground = getGroundHeight(point.x, point.z)
  check([point.x, point.y, point.z, terrain, ground].every(Number.isFinite), `Non-finite trail sample ${i}`)
  check(Math.abs(point.x) < WORLD.halfWidth && point.z >= WORLD.endZ && point.z <= WORLD.startZ,
    `Trail leaves world at ${location(point)}`)
  const error = Math.abs(ground - point.y)
  if (error > maxGroundError) { maxGroundError = error; worstGround = point }
  if (!isWalkable(point.x, point.z)) blocked.push(point)
  if (onBridge(point.x, point.z)) {
    bridgeSamples.push(point)
    check(ground >= riverLevel(point.z) + 0.6, `Bridge is submerged at ${location(point)}`)
  }
  if (previous) {
    const distance = Math.hypot(point.x - previous.point.x, point.z - previous.point.z)
    const grade = Math.abs(ground - previous.ground) / distance
    if (grade > maxGrade) { maxGrade = grade; worstGrade = point }
  }
  previous = { point, ground }
}
check(trailLength > 600, `Journey shrank to ${trailLength.toFixed(1)}m`)
check(maxGroundError <= 0.65, `Trail differs from ground by ${maxGroundError.toFixed(2)}m at ${location(worstGround)}`)
check(maxGrade <= 0.8, `Trail grade ${maxGrade.toFixed(3)} exceeds 0.8 at ${location(worstGrade)}`)
check(blocked.length === 0, `${blocked.length} blocked trail samples; first ${blocked[0] ? location(blocked[0]) : 'none'}`)
check(bridgeSamples.length > 0, 'Trail never reaches the bridge')

// Check both deck seams explicitly: tiny steps catch discontinuities that a
// coarser route sample can miss. Terrain approaches should meet the deck.
for (const side of [-1, 1]) {
  const edge = BRIDGE_X + side * BRIDGE_HALF_LENGTH
  const inside = getGroundHeight(edge - side * 0.01, BRIDGE_Z)
  const outside = getGroundHeight(edge + side * 0.01, BRIDGE_Z)
  check(Math.abs(inside - outside) <= 0.03,
    `Bridge ${side < 0 ? 'west' : 'east'} seam jumps ${Math.abs(inside - outside).toFixed(3)}m`)
}

const futureSites = [
  ...LANDMARKS.map(({ name, position }) => [name, position[0], position[2]]),
  ['village clearing', -52, -8], ['forest', -100, -135],
  ['river', riverX(0), 0], ['waterfall lip', riverX(-180), -180],
  ['stone bridge / railway corridor', BRIDGE_X, BRIDGE_Z],
  ['Horizon mountain', 136, -335], ['summit viewpoint / lone tree', 105, -340],
]
for (const [name, x, z] of futureSites) {
  check(Number.isFinite(getTerrainHeight(x, z)) && Number.isFinite(getGroundHeight(x, z)), `${name} has no finite ground`)
  check(Math.abs(x) < WORLD.halfWidth && z >= WORLD.endZ && z <= WORLD.startZ, `${name} falls outside world bounds`)
}
for (const [label, actual, expected] of [
  ['Origin', samplePath(0), PATH_CONTROL_POINTS[0]],
  ['summit', samplePath(1), PATH_CONTROL_POINTS.at(-1)],
]) {
  check(actual.distanceTo({ x: expected[0], y: expected[1], z: expected[2] }) < 0.001, `${label} endpoint changed`)
}

// Execute Explorer's real useFrame callback. Only React/rendering hooks are
// replaced: movement, inertia, axis collisions and grounding remain app code.
const input = { forward: true, backward: false, left: false, right: false, sprint: false }
const { playerState } = loadSource('src/utils/playerState.ts')
let updateExplorer
moduleOverrides.set('react', { useRef: (current) => ({ current }), useEffect: () => {} })
moduleOverrides.set('@react-three/fiber', { useFrame: (callback) => { updateExplorer = callback } })
moduleOverrides.set('@react-three/drei', {
  useGLTF: Object.assign(() => ({ scene: {}, animations: [] }), { preload: () => {} }),
  useAnimations: () => ({ actions: {} }),
})
moduleOverrides.set('../hooks/useKeyboardControls', { useKeyboardControls: () => ({ current: input }) })
moduleOverrides.set('../hooks/useMouseOrbit', { gameplayInput: { active: true } })
const Explorer = loadSource('src/components/Explorer.tsx').default
const waypoints = pathCurve.getSpacedPoints(Math.ceil(trailLength / 1.5))
for (const [label, sprint, dt] of [['walk / 60fps', false, 1 / 60], ['sprint / 20fps', true, 0.05]]) {
  playerState.position.copy(waypoints[0])
  playerState.position.y = getGroundHeight(playerState.position.x, playerState.position.z)
  playerState.heading = 0
  input.sprint = sprint
  Explorer()
  let waypoint = 1, stalled = 0, crossedBridge = false, frames = 0
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed
  const frameLimit = Math.ceil(trailLength / speed / dt * 2)
  for (; frames < frameLimit; frames++) {
    const position = playerState.position
    const target = waypoints[waypoint]
    const distance = Math.hypot(target.x - position.x, target.z - position.z)
    if (distance < 0.95) {
      if (waypoint === waypoints.length - 1) break
      waypoint++
      continue
    }
    playerState.cameraAzimuth = Math.atan2(position.x - target.x, position.z - target.z)
    const previousX = position.x, previousZ = position.z
    updateExplorer({}, dt)
    const moved = Math.hypot(position.x - previousX, position.z - previousZ)
    stalled = moved < 0.00001 ? stalled + 1 : 0
    crossedBridge ||= onBridge(position.x, position.z)
    if (stalled > 30) break
  }
  check(waypoint === waypoints.length - 1 && frames < frameLimit && stalled <= 30,
    `Explorer ${label} failed at waypoint ${waypoint}/${waypoints.length - 1}, ${location(playerState.position)}`)
  check(crossedBridge, `Explorer ${label} never crossed the deck`)
  console.log(`Explorer ${label}: waypoint ${waypoint}/${waypoints.length - 1}, ${frames} frames, bridge ${crossedBridge ? 'crossed' : 'missed'}`)
}

const modelPath = resolve(root, 'public/assets/models/character-gamer.glb')
const model = readFileSync(modelPath)
assert.equal(model.toString('ascii', 0, 4), 'glTF', 'Mini Arcade model is not GLB')
assert.equal(model.readUInt32LE(4), 2, 'Unsupported GLB version')
assert.equal(model.readUInt32LE(16), 0x4e4f534a, 'GLB JSON chunk is missing')
const gltf = JSON.parse(model.toString('utf8', 20, 20 + model.readUInt32LE(12)))
check(gltf.animations?.length >= 32, 'Mini Arcade original 32 animation clips were lost')
for (const name of ['idle', 'walk', 'sprint']) {
  const clip = gltf.animations?.find((animation) => animation.name === name)
  check(clip?.channels?.length > 0 && clip?.samplers?.length > 0, `Mini Arcade animation ${name} is missing/empty`)
}
check(gltf.materials?.some((material) => material.pbrMetallicRoughness?.baseColorTexture), 'Mini Arcade base color material is missing')
for (const material of gltf.materials ?? []) {
  const textureIndex = material.pbrMetallicRoughness?.baseColorTexture?.index
  check(textureIndex !== undefined && gltf.images?.[gltf.textures?.[textureIndex]?.source],
    `Mini Arcade material ${material.name} no longer resolves its color texture`)
}
for (const image of gltf.images ?? []) {
  if (image.uri && !image.uri.startsWith('data:')) {
    check(existsSync(resolve(dirname(modelPath), decodeURIComponent(image.uri))), `Missing Mini Arcade texture ${image.uri}`)
  } else {
    check(image.bufferView !== undefined || image.uri?.startsWith('data:'), 'Mini Arcade image has no data')
  }
}
check(gltf.images?.length > 0, 'Mini Arcade has no texture images')

console.log(`Trail: ${trailLength.toFixed(1)}m, ${steps + 1} samples, maximum grade ${maxGrade.toFixed(3)}, maximum ground error ${maxGroundError.toFixed(3)}m`)
console.log(`Sites: ${futureSites.length}; bridge: ${bridgeSamples.length} route samples at ${BRIDGE_Y}m; character: ${gltf.animations.length} clips, textures checked`)
assert.equal(failures.length, 0, `World regression checks failed:\n${failures.join('\n')}`)
console.log('PASS: continuous grounded walkable trail, bridge seams, future sites and Mini Arcade assets')
