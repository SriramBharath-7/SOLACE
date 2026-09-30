import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { riverX, riverLevel, riverHalfWidth } from '../utils/terrain'
import { mulberry32 } from '../utils/noise'

function buildRiver() {
  const positions: number[] = [], colors: number[] = [], indices: number[] = []
  const rows: number[] = []
  // Extra samples follow the real 30m drop. Crest, falling sheet and basin
  // remain one continuous surface, grounded in the existing river geometry.
  for (let z = -315; z < 325; z += z > -188 && z < -157 ? 0.3 : 2) rows.push(z)
  rows.push(325)
  const color = new THREE.Color(), edge = new THREE.Color('#90bca9')
  const falling = new THREE.Color('#669e9f')
  rows.forEach((z, row) => {
    const fall = THREE.MathUtils.smoothstep(z, -184, -179)
      * (1 - THREE.MathUtils.smoothstep(z, -169, -164))
    for (let col = 0; col <= 10; col++) {
      const across = col / 5 - 1
      positions.push(riverX(z) + across * riverHalfWidth(z), riverLevel(z) + 0.075, z)
      color.set('#397f83').lerp(edge, Math.abs(across) ** 3 * 0.6).lerp(falling, fall)
      color.multiplyScalar(0.97 + Math.sin(z * 0.3 + across * 6) * 0.03)
      colors.push(color.r, color.g, color.b)
      if (row < rows.length - 1 && col < 10) {
        const n = row * 11 + col
        indices.push(n, n + 11, n + 1, n + 1, n + 11, n + 12)
      }
    }
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function riverMaterial(time: { value: number }) {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.34, metalness: 0.08, side: THREE.DoubleSide,
  })
  material.onBeforeCompile = shader => {
    shader.uniforms.waterTime = time
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float waterTime;\nvarying vec3 waterPosition;')
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        waterPosition = position;
        transformed.y += sin(position.z * 0.72 - waterTime * 1.4 + position.x * 0.31) * 0.025;
      `)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float waterTime;\nvarying vec3 waterPosition;')
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        float z = waterPosition.z;
        float across = waterPosition.x - (25.0 + 20.0 * sin(z * 0.018));
        float fall = smoothstep(-184.0, -179.0, z) * (1.0 - smoothstep(-169.0, -164.0, z));
        float strand = sin(across * 6.1 + sin(across * 2.3) * 2.0 + sin(z * .75 - waterTime * 7.0) * .18);
        float broken = sin(z * 3.7 - waterTime * 11.0 + across * 1.6) * 0.5 + 0.5;
        float curtain = fall * (0.12 + smoothstep(0.4, 0.95, strand) * 0.52 * (0.45 + broken * 0.55) + broken * 0.14);
        float crestDistance = (z + 180.0) / 1.35;
        float impactDistance = (z + 165.0) / 5.0;
        float crest = exp(-crestDistance * crestDistance) * 0.65;
        float impact = exp(-impactDistance * impactDistance);
        float eddy = sin(length(vec2(across, (z + 165.0) * 0.78)) * 3.4 - waterTime * 2.2);
        float foam = max(curtain, max(crest, impact * (0.22 + smoothstep(0.3, 0.95, eddy) * 0.54)));
        float ripple = sin(z * 2.1 - waterTime * 1.2 + sin(across * 0.65) * 2.0);
        diffuseColor.rgb *= 1.0 + ripple * 0.045 * (1.0 - fall);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.91, 0.86), clamp(foam, 0.0, 0.92));
        float width = 6.5 + 3.5 * exp(-pow((z + 142.0) / 36.0, 2.0)) + 1.5 * pow(sin(z * 0.025), 2.0);
        float bank = smoothstep(width - 0.85, width - 0.05, abs(across));
        float lace = smoothstep(.28, .8, sin(z * 4.2 - waterTime * .8 + across * 2.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.62,.77,.66), bank * lace * .45);
      `)
      .replace('#include <normal_fragment_begin>', `
        #include <normal_fragment_begin>
        float flow = waterPosition.z * 1.7 - waterTime * 1.35;
        vec3 wave = vec3(cos(waterPosition.x * 1.9 + flow) * .065, 0.0, sin(flow + waterPosition.x * .6) * .085);
        normal = normalize(normal + mat3(viewMatrix) * wave);
      `)
      .replace('#include <opaque_fragment>', `
        float sheen = pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 3.0);
        outgoingLight = mix(outgoingLight, vec3(.43,.63,.68), sheen * .35);
        #include <opaque_fragment>
      `)
  }
  return material
}

function basinParticles(mist: boolean) {
  const random = mulberry32(mist ? 507 : 711)
  const positions: number[] = [], phases: number[] = []
  const count = mist ? 42 : 100
  for (let i = 0; i < count; i++) {
    const z = -167 + random() * 4
    const x = riverX(z) + (random() - 0.5) * riverHalfWidth(z) * 1.5
    positions.push(x, riverLevel(z) + 0.2, z)
    phases.push(random())
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1))
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      time: { value: 0 }, mist: { value: mist ? 1 : 0 },
      color: { value: new THREE.Color(mist ? '#d4e4dc' : '#eef4e5') },
    }]),
    vertexShader: `
      uniform float time;
      uniform float mist;
      attribute float phase;
      varying float opacity;
      #include <fog_pars_vertex>
      void main() {
        float age = fract(phase + time * mix(0.37, 0.12, mist));
        vec3 p = position;
        p.x += sin(phase * 23.0) * age * mix(1.1, 2.0, mist);
        p.y += mix(3.6 * sin(age * 3.14159), age * 5.4, mist);
        p.z += age * mix(2.5, 4.5, mist);
        opacity = sin(age * 3.14159) * mix(0.6, 0.12, mist);
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        float size = mix(0.11, 2.8 + age * 3.5, mist);
        gl_PointSize = clamp(size * 420.0 / -mvPosition.z, 1.0, 90.0);
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      varying float opacity;
      #include <fog_pars_fragment>
      void main() {
        float radius = length(gl_PointCoord - 0.5) * 2.0;
        float alpha = (1.0 - smoothstep(0.15, 1.0, radius)) * opacity;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  })
  // Vertex animation stays within this padded basin bounding sphere.
  geometry.computeBoundingSphere()
  geometry.boundingSphere!.radius += 8
  return { geometry, material }
}

export default function Water() {
  const water = useMemo(() => {
    const time = { value: 0 }
    return { time, geometry: buildRiver(), material: riverMaterial(time),
      mist: basinParticles(true), spray: basinParticles(false) }
  }, [])
  useFrame(({ clock }) => {
    water.time.value = clock.elapsedTime
    water.mist.material.uniforms.time.value = clock.elapsedTime
    water.spray.material.uniforms.time.value = clock.elapsedTime
  })
  useEffect(() => () => {
    for (const part of [water, water.mist, water.spray]) {
      part.geometry.dispose()
      part.material.dispose()
    }
  }, [water])
  return <group>
    <mesh geometry={water.geometry} material={water.material} receiveShadow />
    <points geometry={water.mist.geometry} material={water.mist.material} />
    <points geometry={water.spray.geometry} material={water.spray.material} />
  </group>
}
