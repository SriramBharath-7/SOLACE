# SOLACE — Phase 1 (Origin) — Build Notes

A small, playable vertical slice (~40–50m) of the Origin meadow, proving art
direction, scale, movement, camera and atmosphere before any further world is
built.

## ⚠️ Important: not build-verified in the delivery sandbox

The sandbox this was built in has **no network access**, so `npm install`
could not run and `tsc -b && npm run build` could not be executed or
verified here. Every file was hand-written against my working knowledge of
React Three Fiber / drei / Three.js APIs, and the TSX was passed through a
local syntax-only TypeScript check (no real type errors found — only
expected "missing module" noise from having no `node_modules`). But you
should still run the real build yourself as the first step:

```bash
npm install
npm run dev      # sanity-check in the browser
npm run build    # tsc -b && vite build — fix anything that surfaces
```

If something doesn't compile, it's most likely a minor drei/R3F version-API
mismatch (e.g. a prop rename) rather than a logic error — those are quick
fixes.

## Architecture

```
src/
  constants.ts          world size, trail control points, player/camera/lighting tuning
  utils/
    noise.ts             tiny dependency-free value-noise + seeded PRNG
    path.ts               Catmull-Rom trail spline + distance-to-path helper
    terrain.ts             shared getTerrainHeight(x,z) + terrain geometry/vertex-color builder
    ridge.ts                procedural distant-mountain silhouette geometry
    vegetationLayout.ts      deterministic zoned placement (meadow -> clusters -> framing -> boundary -> forest edge)
    wind.ts                   onBeforeCompile vertex-sway injected into foliage materials
    playerState.ts             tiny shared mutable singleton (position/heading/camera azimuth)
  hooks/
    useKeyboardControls.ts     WASD + Shift, ref-based (no re-renders)
    useMouseOrbit.ts            whole-window mouse tracking -> target azimuth/pitch/zoom
  components/
    Scene.tsx                  composes everything inside <Canvas>
    Terrain.tsx / Water.tsx / Bridge.tsx
    Vegetation.tsx + InstancedModel.tsx   generic GLB -> drei <Instances> renderer
    DistantMountains.tsx        non-playable layered backdrop
    SkyAndLight.tsx              drei <Sky>, sun/hemi/ambient lights, fog, drifting clouds
    Explorer.tsx / CameraRig.tsx
    IntroUI.tsx / LoadingScreen.tsx
  App.tsx, main.tsx, styles.css
```

`getTerrainHeight(x, z)` in `utils/terrain.ts` is the single source of truth
for ground elevation — the terrain mesh, the player's grounding, and every
piece of vegetation all sample it, so nothing floats or clips. The trail
itself is one Catmull-Rom spline (`utils/path.ts`) built from hand-placed
control points in `constants.ts`; terrain flattening near the path,
vegetation exclusion near the path, and the bridge's position all read from
that same spline, so retuning the trail's shape in one place keeps
everything else in sync.

## Assets actually used (from the supplied Kenney zips)

All copied into `public/assets/models/` (~364KB total — a deliberately small
subset, not an asset-dump):

| File | Source pack | Used as |
|---|---|---|
| `character-gamer.glb` | kenney_mini-arcade | **The explorer** (confirmed: blue/purple cap, orange shirt, blue shorts, white shoes — matches the reference image) |
| `tree-pine-tall.glb` (`tree_pineTallA_detailed`) | kenney_nature-kit | boundary/forest-edge pines |
| `tree-pine-round.glb` (`tree_pineRoundC`) | kenney_nature-kit | mid-slice cluster trees |
| `tree-pine-small.glb` (`tree_pineSmallA`) | kenney_nature-kit | undergrowth pines |
| `tree-oak.glb` | kenney_nature-kit | foreground "framing" trees near spawn |
| `rock-large.glb`, `rock-small.glb`, `rock-small-flat.glb` | kenney_nature-kit | scattered rocks |
| `flower-purple.glb`, `flower-red.glb`, `flower-yellow.glb` | kenney_nature-kit | meadow color |
| `bush-small.glb`, `bush-detailed.glb`, `grass-large.glb` | kenney_nature-kit | undergrowth |
| `bridge-wood.glb` | kenney_nature-kit | stream crossing |

**Packs not used in Phase 1** (kept out of the delivered zip): mini-forest,
fantasy-town-kit, platformer-kit, train-kit, survival-kit. Per the brief,
these are earmarked for later regions (Craft settlement, railway, etc.) —
pulling from them now would have meant asset-dumping instead of a coherent
Origin meadow.

## Controls

- `W` / `↑` — forward · `S` / `↓` — backward · `A` / `←` — left · `D` / `→` — right
- `Shift` — sprint
- **Mouse movement alone** orbits the camera (no click-drag, no pointer lock) — horizontal position orbits azimuth, vertical position adjusts a clamped pitch
- Mouse wheel — zoom, clamped to a comfortable range

## Key configuration (all in `src/constants.ts`)

- `WORLD` — playable half-width (26m) and Z extent (22 to -26, ~48m) — tune `PATH_CONTROL_POINTS` to reshape the trail
- `STREAM_Z` / `STREAM_WIDTH` — stream crossing position/width
- `PLAYER` — walk/sprint speed, accel/decel, turn speed, model scale
- `CAMERA` — distance, height, pitch clamp, damping
- `LIGHTING` — sun position/color, fog color/near/far — this is the hook point for the later day/night progression (Section 6 of the brief): swap these over time and everything downstream (fog, Sky, directional light) already reads from one config object

## Known limitations / things to sanity-check first in-browser

1. **Build unverified** (see warning above) — run `npm install && npm run dev` first.
2. **Character forward-facing axis is assumed.** `Explorer.tsx` assumes the
   glTF's front faces -Z (the Kenney/glTF convention). If the character
   appears to walk backwards, flip it by changing the heading formula in
   `Explorer.tsx` (`Math.atan2(velocity.current.x, velocity.current.z) + Math.PI` → drop the `+ Math.PI`).
3. **Bridge scale/rotation is eyeballed**, not verified against the actual
   `bridge_wood.glb` footprint in a live render — nudge `scale`/`position` in
   `Bridge.tsx` once you see it in place.
4. Vegetation instancing assumes each GLB's meshes are already in
   "world-ready" local space (pivot at the base). This is true for Kenney's
   exports in general but wasn't rendered/eyeballed here — if a tree or rock
   appears offset from its footprint, its geometry may need a small
   position/pivot correction in `InstancedModel.tsx`.
5. No sound, no interaction system, no portfolio content — intentionally,
   per the brief (Section 9).

## Recommended next step

1. `npm install && npm run dev`, walk the slice, and tune to taste — the
   things most worth eyeballing first are: character orientation (#2 above),
   bridge placement (#3), and the density/mix in `vegetationLayout.ts`
   (counts and zone ranges are all in one table, easy to iterate on).
2. Once Origin feels right, that's the natural point to start Phase 2 (Craft
   settlement) — extending the same terrain/vegetation/path system rather
   than starting over.
