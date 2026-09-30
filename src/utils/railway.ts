/** The railway crosses the existing valley; the walking trail passes below it. */
export const RAIL_Z = -65
export const RAIL_HEIGHT = 43
export const RAIL_PORTAL_X = 152
export const RAIL_SPEED = 6.5
export const RAIL_CAR_SPACING = 6.6
const END = 207
const CROSSING_SECONDS = END * 2 / RAIL_SPEED
const TUNNEL_PAUSE = 9

/** Metres along the track, with reversals entirely behind the tunnel back walls. */
export function sampleTrain(seconds: number) {
  const leg = CROSSING_SECONDS + TUNNEL_PAUSE
  const phase = ((seconds % (leg * 2)) + leg * 2) % (leg * 2)
  const direction = phase < leg ? 1 : -1
  const elapsed = phase % leg
  const distance = Math.min(elapsed, CROSSING_SECONDS) * RAIL_SPEED
  return { x: direction * (-END + distance), direction, moving: elapsed < CROSSING_SECONDS }
}

export function inRailCorridor(x: number, z: number) {
  return Math.abs(x) < 181 && Math.abs(z - RAIL_Z) < 8
}
