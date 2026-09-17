import * as THREE from 'three'

// Injects a tiny sine-based vertex displacement into a standard material so
// foliage sways subtly without any per-frame CPU work or simulation system.
// Height-weighted (uses local Y) so trunks/bases stay put and canopies move.

const windShaders = new Set<{ uniforms: { uTime: { value: number } } }>()

export function applyWindSway(
  material: THREE.Material,
  opts: { strength?: number; speed?: number; scale?: number } = {},
) {
  const strength = opts.strength ?? 0.045
  const speed = opts.speed ?? 0.7
  const scale = opts.scale ?? 0.35

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 }
    windShaders.add(shader as any)
    ;(material as any).userData.shader = shader

    shader.vertexShader =
      'uniform float uTime;\n' + shader.vertexShader

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
      float windSeed = instanceMatrix[3].x + instanceMatrix[3].z;
      #else
      float windSeed = 0.0;
      #endif
      float windPhase = uTime * ${speed.toFixed(3)} + windSeed * ${scale.toFixed(3)};
      float windAmount = smoothstep(0.0, 1.4, position.y) * ${strength.toFixed(4)};
      transformed.x += sin(windPhase) * windAmount;
      transformed.z += cos(windPhase * 0.8) * windAmount * 0.6;`,
    )
  }
  material.customProgramCacheKey = () => 'wind-sway'
}

/** Called once per frame from the scene root to advance every registered
 * wind-sway shader (foliage materials only — a handful of uniform writes,
 * negligible cost). */
export function tickWind(time: number) {
  windShaders.forEach((shader) => {
    shader.uniforms.uTime.value = time
  })
}
