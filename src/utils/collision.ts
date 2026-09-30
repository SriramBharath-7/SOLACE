import * as THREE from 'three'

// Static solid surfaces only: a small spatial grid, no physics simulation.
// The explorer's existing axis sliding, acceleration and grounding stay in charge.
const CELL = 8
const MAX_RADIUS = 1
export const BODY_RADIUS = 0.3
export const BODY_HEIGHT = 1.05
let triangles = new Float32Array()
const cells = new Map<string, number[]>()
let ready = false
export const collisionsReady = () => ready

export function clearSolidCollisions() {
  cells.clear()
  triangles = new Float32Array()
  ready = false
}

export function buildSolidCollisions(root: THREE.Object3D) {
  clearSolidCollisions()
  root.updateMatrixWorld(true)
  const vertices: number[] = []
  const points = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const instance = new THREE.Matrix4(), matrix = new THREE.Matrix4()
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    let owner: THREE.Object3D | null = object
    while (owner && owner.userData.solid === undefined) owner = owner.parent
    if (!owner?.userData.solid) return
    const geometry = object.geometry, position = geometry.attributes.position, index = geometry.index
    const count = index?.count ?? position.count
    const instances = object instanceof THREE.InstancedMesh ? object.count : 1
    for (let n = 0; n < instances; n++) {
      matrix.copy(object.matrixWorld)
      if (object instanceof THREE.InstancedMesh) {
        object.getMatrixAt(n, instance)
        matrix.multiply(instance)
      }
      for (let i = 0; i < count; i += 3) {
        for (let j = 0; j < 3; j++) points[j].fromBufferAttribute(position, index ? index.getX(i + j) : i + j).applyMatrix4(matrix)
        const [a, b, c] = points, id = vertices.length
        vertices.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
        const minX = Math.floor((Math.min(a.x, b.x, c.x) - MAX_RADIUS) / CELL)
        const maxX = Math.floor((Math.max(a.x, b.x, c.x) + MAX_RADIUS) / CELL)
        const minZ = Math.floor((Math.min(a.z, b.z, c.z) - MAX_RADIUS) / CELL)
        const maxZ = Math.floor((Math.max(a.z, b.z, c.z) + MAX_RADIUS) / CELL)
        for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
          const key = `${x},${z}`, list = cells.get(key)
          if (list) list.push(id)
          else cells.set(key, [id])
        }
      }
    }
  })
  triangles = new Float32Array(vertices)
  ready = true
  return { triangles: vertices.length / 9, cells: cells.size }
}

// Clip each nearby triangle to the body's height before testing its XZ footprint.
// This leaves overhead arches/canopies open and ignores pebbles below the ankles.
const polygonA = new Float64Array(24), polygonB = new Float64Array(24)
function clipHeight(input: Float64Array, count: number, output: Float64Array, y: number, above: boolean) {
  let written = 0
  for (let i = 0; i < count; i++) {
    const a = i * 3, b = ((i + 1) % count) * 3
    const insideA = above ? input[a + 1] >= y : input[a + 1] <= y
    const insideB = above ? input[b + 1] >= y : input[b + 1] <= y
    if (insideA) {
      output[written++] = input[a]; output[written++] = input[a + 1]; output[written++] = input[a + 2]
    }
    if (insideA !== insideB) {
      const t = (y - input[a + 1]) / (input[b + 1] - input[a + 1])
      output[written++] = input[a] + (input[b] - input[a]) * t
      output[written++] = y
      output[written++] = input[a + 2] + (input[b + 2] - input[a + 2]) * t
    }
  }
  return written / 3
}

export function isBlocked(x: number, z: number, y: number, radius = BODY_RADIUS, height = BODY_HEIGHT) {
  const nearby = cells.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`)
  if (!nearby) return false
  const bottom = y + Math.min(0.18, height * 0.18), top = y + height
  for (const id of nearby) {
    const ay = triangles[id + 1], by = triangles[id + 4], cy = triangles[id + 7]
    if (Math.max(ay, by, cy) < bottom || Math.min(ay, by, cy) > top) continue
    for (let j = 0; j < 9; j++) polygonA[j] = triangles[id + j]
    let count = clipHeight(polygonA, 3, polygonB, bottom, true)
    count = clipHeight(polygonB, count, polygonA, top, false)
    let inside = false
    for (let i = 0; i < count; i++) {
      const a = i * 3, b = ((i + 1) % count) * 3
      const ax = polygonA[a], az = polygonA[a + 2], bx = polygonA[b], bz = polygonA[b + 2]
      const dx = bx - ax, dz = bz - az, lengthSq = dx * dx + dz * dz
      const t = lengthSq ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSq)) : 0
      if ((x - ax - dx * t) ** 2 + (z - az - dz * t) ** 2 < radius * radius) return true
      if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside
    }
    if (inside) return true
  }
  return false
}

export function moveHitsSolid(fromX: number, fromZ: number, toX: number, toZ: number, y: number,
  radius = BODY_RADIUS, height = BODY_HEIGHT, toY = y) {
  // Substeps keep thin rails/fence posts solid even during a 20fps sprint.
  const steps = Math.max(1, Math.ceil(Math.hypot(toX - fromX, toZ - fromZ) / (radius * 0.5)))
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    if (isBlocked(fromX + (toX - fromX) * t, fromZ + (toZ - fromZ) * t, y + (toY - y) * t, radius, height)) return true
  }
  return false
}
