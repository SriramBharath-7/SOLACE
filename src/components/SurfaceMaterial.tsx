import { useMemo, useEffect } from 'react'
import * as THREE from 'three'

/** Quiet world-space pigment and grain; no texture downloads or extra passes. */
export default function SurfaceMaterial({ color = '#ffffff', strength = 0.16, roughness = 0.94, vertexColors = true, side = THREE.FrontSide, masonry = false }: {
  color?: string; strength?: number; roughness?: number; vertexColors?: boolean; side?: THREE.Side; masonry?: boolean
}) {
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color, vertexColors, roughness, side })
    m.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 surfacePoint;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nsurfacePoint = (modelMatrix * vec4(position, 1.0)).xyz;')
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
        #include <common>
        varying vec3 surfacePoint;
        float pigment(vec3 p) {
          vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          vec3 q=vec3(17.13,57.71,113.5);
          float n=dot(i,q);
          return mix(mix(mix(fract(sin(n)*43758.5),fract(sin(n+q.x)*43758.5),f.x),
            mix(fract(sin(n+q.y)*43758.5),fract(sin(n+q.x+q.y)*43758.5),f.x),f.y),
            mix(mix(fract(sin(n+q.z)*43758.5),fract(sin(n+q.x+q.z)*43758.5),f.x),
            mix(fract(sin(n+q.y+q.z)*43758.5),fract(sin(n+q.x+q.y+q.z)*43758.5),f.x),f.y),f.z);
        }
      `).replace('#include <color_fragment>', `
        #include <color_fragment>
        float patina = pigment(surfacePoint * 1.7) * 0.65 + pigment(surfacePoint * 8.0) * 0.35;
        diffuseColor.rgb *= 1.0 + (patina - 0.52) * ${strength.toFixed(3)};
        ${masonry ? `
          vec2 brick = vec2(surfacePoint.x / 2.4 + mod(floor(surfacePoint.y / .95), 2.0) * .5, surfacePoint.y / .95);
          vec2 seam = min(fract(brick), 1.0-fract(brick));
          vec2 aa = max(fwidth(brick), vec2(.006));
          float mortar = 1.0-min(smoothstep(.012,.012+aa.x,seam.x),smoothstep(.025,.025+aa.y,seam.y));
          float blockTone = pigment(vec3(floor(brick),0.0)*2.7);
          diffuseColor.rgb *= .92 + blockTone * .16 - mortar * .18;
        ` : ''}
      `)
    }
    m.customProgramCacheKey = () => `pigment-${strength}-${masonry}`
    return m
  }, [color, strength, roughness, vertexColors, side, masonry])
  useEffect(() => () => material.dispose(), [material])
  return <primitive object={material} attach="material" />
}
