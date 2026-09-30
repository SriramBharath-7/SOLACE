// Run against npm run dev: node scripts/check-collision.mjs
// Reads the collision registry built from the actual rendered world, including GLBs.
import assert from 'node:assert/strict'
import { chromium } from 'file:///D:/JARVIS/JARVIS/.venv/Lib/site-packages/playwright/driver/package/index.mjs'

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-webgl'] })
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 550, height: 350 } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
    if (message.text().startsWith('SOLACE collisions')) console.log(message.text())
  })
  await page.goto('http://127.0.0.1:5173/?vista=home', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => document.documentElement.dataset.worldReady === 'true', null, { timeout: 240000 })
  await page.locator('.solace-loading').waitFor({ state: 'hidden', timeout: 180000 })
  const result = await page.evaluate(async () => {
    const collision = await import('/src/utils/collision.ts')
    const terrain = await import('/src/utils/terrain.ts')
    const { samplePath, trailLength } = await import('/src/utils/path.ts')
    const { COTTAGES, regionTrailSamples } = await import('/src/utils/regionLayout.ts')
    const { buildVegetationLayout } = await import('/src/utils/vegetationLayout.ts')
    const { isBlocked, moveHitsSolid } = collision
    const { getGroundHeight, isWalkable } = terrain
    const checks = [], failures = []
    const check = (name, actual, expected = true) => {
      checks.push({ name, actual, expected })
      if (actual !== expected) failures.push(name)
    }
    check('live registry ready', collision.collisionsReady())
    const world = (x, z, yaw, lx, lz) => [x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z - lx * Math.sin(yaw) + lz * Math.cos(yaw)]
    const sweep = (name, from, to, expected = true) => check(name,
      moveHitsSolid(...from, ...to, getGroundHeight(...from), undefined, undefined, getGroundHeight(...to)), expected)

    for (const id of ['home', 'workshop', 'growhouse']) {
      const b = COTTAGES.find(b => b.id === id)
      const point = (lx, lz) => world(b.x, b.z, b.yaw, lx, lz)
      // Cross a side wall, clear of front steps and outdoor furniture.
      sweep(`${id} actual rotated side wall`, point(b.w / 2 + 2, 0), point(b.w / 2 - 1, 0))
    }
    sweep('viaduct pier at x=32', [32, -58], [32, -65])
    sweep('Origin fence rail between posts', [-83, 227], [-83, 231])
    const camp = (x, z) => world(-74.8, -117.5, -0.2, x, z)
    sweep('research table across middle between legs', camp(0, 1.3), camp(0, -1.8))
    sweep('camp corner upright', camp(-3.2, 3.8), camp(-3.2, 2.1))
    sweep('Craft workbench', [-64, -9], [-64, -13.5])
    sweep('walk below viaduct arch', [-85, -59], [-85, -71], false)
    sweep('walk across bridge centre', [terrain.BRIDGE_X - 12, terrain.BRIDGE_Z], [terrain.BRIDGE_X + 12, terrain.BRIDGE_Z], false)
    sweep('bridge side railing', [terrain.BRIDGE_X, terrain.BRIDGE_Z], [terrain.BRIDGE_X, terrain.BRIDGE_Z + 3])

    const layout = buildVegetationLayout(1337)
    for (const key of ['pineTall', 'pineRound', 'pineSmall', 'oak']) {
      const tree = layout[key][0], [x, , z] = tree.position
      sweep(`${key} actual trunk`, [x - 2, z], [x + 2, z])
    }
    const rock = layout.rockLarge.find(p => p.scale > 3) ?? layout.rockLarge[0]
    const [rx, , rz] = rock.position
    sweep('large nature rock', [rx - rock.scale, rz], [rx + rock.scale, rz])

    const blockedTrail = [], samples = Math.ceil(trailLength / 0.2)
    const queryStart = performance.now()
    for (let i = 0; i <= samples; i++) {
      const p = samplePath(i / samples)
      if (isBlocked(p.x, p.z, getGroundHeight(p.x, p.z))) blockedTrail.push([p.x, p.z])
    }
    const queryMilliseconds = performance.now() - queryStart
    const blockedForest = []
    for (const [index, points] of regionTrailSamples.entries()) {
      const blocked = points.filter(p => isBlocked(p.x, p.z, getGroundHeight(p.x, p.z)))
      blockedForest.push(...blocked.map(p => [p.x, p.z]))
    }
    // Existing scenery already overlaps a few painted trail centrelines. Prove
    // that players can take short continuous detours without moving that scenery.
    function corridor(points, width) {
      const half = width * 2, count = half * 2 + 1
      let prior = [], reachable = []
      for (let row = 0; row < points.length; row++) {
        const p = points[row], a = points[Math.max(0, row - 1)], b = points[Math.min(points.length - 1, row + 1)]
        const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz)
        const nodes = Array.from({ length: count }, (_, i) => {
          const offset = (i - half) * 0.5, x = p.x - dz / length * offset, z = p.z + dx / length * offset
          const y = getGroundHeight(x, z)
          return { x, z, y, clear: isWalkable(x, z) && !isBlocked(x, z, y) }
        })
        const next = nodes.map((n, i) => {
          if (!n.clear) return false
          if (!row) return i === half
          for (let j = Math.max(0, i - 1); j <= Math.min(count - 1, i + 1); j++) {
            if (!reachable[j]) continue
            const p = prior[j]
            if (Math.abs(p.y - n.y) >= 0.7) continue
            const mx = (p.x + n.x) / 2, mz = (p.z + n.z) / 2
            if (isWalkable(mx, mz) && !moveHitsSolid(p.x, p.z, n.x, n.z, p.y, undefined, undefined, n.y)) return true
          }
          return false
        })
        if (!next.some(Boolean)) return { connected: false, row, point: [p.x, p.z], width }
        prior = nodes; reachable = next
      }
      return { connected: reachable[half], rows: points.length, width }
    }
    const routeRows = Math.ceil(trailLength / 0.4) + 1
    const corridors = [corridor(Array.from({ length: routeRows }, (_, i) => samplePath(i / (routeRows - 1))), 3)]
    check('928m journey has a connected corridor within 3m', corridors[0].connected)
    for (const [index, points] of regionTrailSamples.entries()) {
      const result = corridor(points, 4)
      corridors.push(result)
      check(`forest side trail ${index + 1} has a connected corridor within 4m`, result.connected)
    }

    // Run Explorer's mounted useFrame callback with its real keyboard refs and
    // static registry. Skipping rendering makes 20fps/60fps contact tests fast.
    const appSource = await (await fetch('/src/App.tsx')).text()
    const fiberUrl = appSource.match(/from\s+["']([^"']*react-three_fiber[^"']*)/)[1]
    const { _roots } = await import(fiberUrl)
    const state = _roots.get(document.querySelector('canvas')).store.getState()
    const updateExplorer = state.internal.subscribers.find(s => s.ref.current.toString().includes('moveHitsSolid'))?.ref.current
    check('mounted Explorer callback found', !!updateExplorer)
    const movement = []
    if (updateExplorer) {
      // Match Vite's HMR URLs so this is the mounted controller's singleton,
      // even when the dev server has already served an earlier file version.
      const explorerSource = await (await fetch('/src/components/Explorer.tsx')).text()
      const liveImport = name => explorerSource.match(new RegExp(`from\\s+["']([^"']*/${name}\\.ts[^"']*)`))[1]
      const { playerState } = await import(liveImport('playerState'))
      const { gameplayInput } = await import(liveImport('useMouseOrbit'))
      state.setFrameloop('never')
      const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }))
      const move = (from, direction, sprint, seconds) => {
        gameplayInput.active = false
        key('KeyW', false); key('ShiftLeft', false)
        updateExplorer(state, 0.05)
        playerState.position.set(from[0], getGroundHeight(...from), from[1])
        playerState.cameraAzimuth = Math.atan2(-direction[0], -direction[1])
        gameplayInput.active = true
        key('KeyW', true); key('ShiftLeft', sprint)
        const dt = sprint ? 0.05 : 1 / 60, frames = Math.ceil(seconds / dt)
        let lastX = from[0], lastZ = from[1]
        for (let i = 0; i < frames; i++) {
          if (i === frames - 10) { lastX = playerState.position.x; lastZ = playerState.position.z }
          updateExplorer(state, dt)
        }
        key('KeyW', false); key('ShiftLeft', false)
        gameplayInput.active = false
        const p = playerState.position
        return { x: p.x, z: p.z, distance: Math.hypot(p.x - from[0], p.z - from[1]),
          settled: Math.hypot(p.x - lastX, p.z - lastZ) < 0.01, clear: !isBlocked(p.x, p.z, p.y) }
      }
      for (const sprint of [false, true]) for (const [name, from, direction, limit] of [
        ['cottage wall', [-83, 226.8], [0, -1], 2],
        ['viaduct pier', [32, -58], [0, -1], 4.5],
        ['Origin fence', [-83, 227], [0, 1], 2],
      ]) {
        const result = move(from, direction, sprint, 2)
        movement.push({ name, sprint, ...result })
        check(`Explorer ${sprint ? '20fps sprint' : '60fps walk'} stops at ${name}`,
          result.distance > 0.3 && result.distance < limit && result.settled && result.clear)
      }
      const slide = move([-85.3, 226], [1, -1], false, 0.6)
      movement.push({ name: 'wall slide', ...slide })
      check('Explorer slides along cottage wall', slide.x > -83.3 && slide.z > 224.9 && slide.clear)
    }
    const owners = []
    if (corridors.some(result => !result.connected)) {
      // Identify actual offending meshes only on failure, then restore the registry.
      const scene = state.scene
      const probes = [...blockedTrail, ...blockedForest]
      scene.traverse(object => {
        if (!object.isMesh) return
        let owner = object
        while (owner && owner.userData.solid === undefined) owner = owner.parent
        if (!owner?.userData.solid) return
        collision.buildSolidCollisions(object)
        const hits = probes.filter(([x, z]) => isBlocked(x, z, getGroundHeight(x, z)))
        if (hits.length) owners.push({ name: object.name, vertices: object.geometry.attributes.position.count,
          material: Array.isArray(object.material) ? object.material.map(m => m.name) : object.material.name,
          instances: object.count, points: hits })
      })
      collision.buildSolidCollisions(scene)
    }
    return { checks, failures, blockedTrail, blockedForest, owners, corridors, movement, queryMilliseconds, samples: samples + 1 }
  })
  for (const check of result.checks) console.log(`${check.actual === check.expected ? 'PASS' : 'FAIL'} ${check.name}: ${check.actual}`)
  console.log(`Main trail: ${result.samples} queries in ${result.queryMilliseconds.toFixed(1)}ms; ${result.blockedTrail.length} centreline samples need short detours around existing props`)
  console.log('Corridors:', JSON.stringify(result.corridors))
  console.log('Actual Explorer contacts:', JSON.stringify(result.movement))
  if (result.owners.length) console.log('Blocking meshes:', JSON.stringify(result.owners))
  assert.deepEqual(result.failures, [], 'Actual-world collision checks failed')
  assert.deepEqual(errors, [], 'Browser errors')
} finally {
  await browser.close()
}
