// Metres. Authored landforms and trail grades define the journey.
export const WORLD = { halfWidth: 320, startZ: 300, endZ: -600, segments: 40 }
export const PATH_CONTROL_POINTS: [number, number, number][] = [
  [-94,52,220],[-106,48,188],[-110,42,160],[-94,32,127],[-74,24,100],
  [-83,20,73],[-54,15,42],[-52,15,-8],[-85,20,-64],[-108,26,-104],
  [-100,28,-135],[-75,34,-160],[-45,40,-180],[-15,46,-207],
  [12,47.95,-212],[24,47.95,-212],[51,47.95,-212],[63,47.95,-212],
  [80,52,-222],[110,58,-235],[165,80,-260],[194,95,-291],[182,107,-330],
  [154,120,-354],[138,135,-375],[116,143,-363],[105,148,-340],
]
export const LANDMARKS = [
  { name:'Origin', subtitle:'The valley opens', position:[-94,52,220], t:0 },
  { name:'Craft', subtitle:'A place to put down roots', position:[-52,15,-8], t:0.27 },
  { name:'Curiosity', subtitle:'Into the green', position:[-100,28,-135], t:0.43 },
  { name:'Horizon', subtitle:'A little further, a little higher', position:[105,148,-340], t:1 },
] as const
export const PLAYER = {
  walkSpeed:7.5, sprintSpeed:13, acceleration:18, deceleration:9,
  turnSpeed:9, scale:1.35, modelYawOffset:Math.PI,
}
// SOLACE_CAM_EXACT.html: delta input, position lag and live look target.
export const CAMERA = {
  distance:6.2, height:2.6, minPitch:-0.5, maxPitch:0.3,
  azimuthSensitivity:0.0022, pitchSensitivity:0.0015, positionDamping:6,
}
export const LIGHTING = {
  sunPosition:[300,230,-420] as [number,number,number],
  sunColor:'#ffdbab', sunIntensity:2.5, hemiSky:'#c0daed',
  hemiGround:'#65764b', hemiIntensity:1.5,
  fogColor:'#b9ccd0', fogNear:220, fogFar:1400,
}

