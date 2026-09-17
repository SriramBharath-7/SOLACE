import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LIGHTING } from '../constants'
import { playerState } from '../utils/playerState'

const skyVertex = `
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const skyFragment = `
  varying vec3 vDirection;
  uniform vec3 zenith;
  uniform vec3 horizon;
  uniform vec3 sunDirection;
  uniform vec3 warm;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
      mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
  }
  void main() {
    vec3 d = normalize(vDirection);
    float elevation = max(d.y, 0.0);
    vec3 color = mix(horizon, zenith, pow(elevation, 0.48));
    float sun = max(dot(d, sunDirection), 0.0);
    color = mix(color, warm, pow(sun, 9.0) * 0.40);
    color += warm * pow(sun, 180.0) * 0.15;
    color = mix(color, vec3(1.0, 0.92, 0.68), smoothstep(0.99965, 0.99984, sun));
    // Quiet painted cloud bands: local shader, no texture fetch.
    vec2 p = d.xz / max(d.y + 0.25, 0.1) * 3.8;
    float cloud = noise(p) * 0.65 + noise(p * 2.9) * 0.25 + noise(p * 7.0) * 0.1;
    float band = smoothstep(0.12, 0.24, d.y) * (1.0 - smoothstep(0.37, 0.66, d.y));
    cloud = smoothstep(0.57, 0.78, cloud) * band * 0.40;
    color = mix(color, mix(vec3(0.83, 0.87, 0.90), warm, pow(sun, 4.0) * 0.7), cloud);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function PaintedSky() {
  const dome = useRef<THREE.Mesh>(null)
  const uniforms = useMemo(() => ({
    zenith: { value: new THREE.Color('#76a9ca') },
    horizon: { value: new THREE.Color('#d2d8cc') },
    warm: { value: new THREE.Color('#f8ce91') },
    sunDirection: { value: new THREE.Vector3(...LIGHTING.sunPosition).normalize() },
  }), [])
  useFrame(({ camera }) => { dome.current?.position.copy(camera.position) })
  return (
    <mesh ref={dome} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[1800, 32, 16]} />
      <shaderMaterial uniforms={uniforms} vertexShader={skyVertex} fragmentShader={skyFragment}
        side={THREE.BackSide} depthWrite={false} />
    </mesh>
  )
}

export default function SkyAndLight() {
  const sunlight = useRef<THREE.DirectionalLight>(null)
  const lightTarget = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    if (!sunlight.current) return
    const p = playerState.position
    // The detailed 70m shadow region follows the explorer across the valley.
    sunlight.current.position.set(p.x + 80, p.y + 130, p.z - 100)
    lightTarget.position.copy(p)
    lightTarget.updateMatrixWorld()
  })
  return (
    <>
      <fog attach="fog" args={[LIGHTING.fogColor, LIGHTING.fogNear, LIGHTING.fogFar]} />
      <PaintedSky />
      <primitive object={lightTarget} />
      <directionalLight ref={sunlight} target={lightTarget}
        position={LIGHTING.sunPosition} color={LIGHTING.sunColor} intensity={LIGHTING.sunIntensity}
        castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-left={-35} shadow-camera-right={35} shadow-camera-top={35} shadow-camera-bottom={-35}
        shadow-camera-near={1} shadow-camera-far={330} shadow-bias={-0.00008} shadow-normalBias={0.045} />
      <hemisphereLight color={LIGHTING.hemiSky} groundColor={LIGHTING.hemiGround} intensity={LIGHTING.hemiIntensity} />
      <ambientLight intensity={0.14} color="#ffe1bd" />
    </>
  )
}

