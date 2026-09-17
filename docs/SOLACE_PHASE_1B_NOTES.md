# SOLACE — Phase 1B (Foundation Repair) — Patch Notes

This is a **delta patch** on top of `SOLACE-Phase-1.zip` — apply it over that
project, overwriting the listed files. It does not touch terrain generation,
grounding, the trail, the stream, the bridge, or the loading screen, all of
which were confirmed working and preserved as-is.

## ⚠️ Still not build-verified

Same constraint as Phase 1: this sandbox has no network access, so
`npm install` / real `tsc -b` couldn't run here. I ran a local syntax-only
TypeScript pass instead (no real bugs surfaced — only the expected noise
from `node_modules` not existing: missing-module errors, and `key` prop
mismatches on every component, which happen because `@types/react` isn't
installed to tell the checker `key` is exempt from prop typing). **Run
`npm install && npm run dev` yourself first.**

---

## 1. White explorer — root cause & fix

**Root cause:** `character-gamer.glb` is a hybrid export — its binary chunk
embeds the mesh/skin/animation data, but its one material still points at an
**external** image via a relative URI:

```json
"images": [{ "uri": "Textures/colormap.png", "name": "colormap" }]
```

Phase 1 copied `character-gamer.glb` into `public/assets/models/` but never
copied that texture, so the loader's fetch for `Textures/colormap.png`
(resolved relative to the glb's own URL) 404'd and three.js silently fell
back to an untextured white material.

**Fix:** copied the real file from the Mini Arcade kit
(`kenney_mini-arcade/Models/GLB format/Textures/colormap.png`) to
`public/assets/models/Textures/colormap.png` — i.e. the exact relative path
the glb already expects. No material/color values were guessed or
hand-assigned; this restores the model's actual intended texture (a packed
color-atlas strip — the cap/shirt/pants/shoes colors come from UVs pointing
at different swatches in that single image).

## 2. Animation — the GLB genuinely has usable clips

Inspected the glb's JSON chunk directly (not guessed): **32 animation
clips** exist, including real, non-empty `idle` (4 channels), `walk` (7
channels), and `sprint` (7 channels) — plus many combat/vehicle/emote clips
irrelevant to Phase 1B. Both skinned meshes (`body-mesh`, `head-mesh`) share
one skeleton (`root/leg-left/leg-right/torso/arm-left/arm-right/head`), so a
single `useAnimations` mixer on the loaded scene drives both correctly.

`Explorer.tsx` now runs a small state machine off actual velocity (not raw
key state):
- **idle** when speed < 0.15
- **walk** while moving, `timeScale` gently scaled to how fast the explorer
  is actually going (0.7–1.3×) so the gait doesn't slide
- **sprint** while Shift is held and speed is high enough, similarly scaled
- Transitions use `crossFadeFrom(prev, 0.35s)` for a smooth blend, no hard cuts

## 3. Orientation fix

The model's local mesh front turned out to face **+Z**, not the -Z
"into the journey" convention the movement/heading math uses (confirmed by
your in-browser test — it faced the spawn camera). Fixed with a single
constant, `PLAYER.modelYawOffset = Math.PI`, applied only to the visual
model's yaw (`modelYaw.rotation.y = heading + modelYawOffset`). The heading
calculation itself, the camera-relative `forwardDir`/`rightDir` vectors, and
WASD mapping are all untouched — per your instruction not to compensate by
reversing controls.

## 4. Camera — what was adapted from sri07-phase1.html, and what wasn't

Studied `updateCamera()`/`updateDrone()` in the reference. The part that
actually produces the "smooth, controlled" feel is a specific **split**:

- `camera.position` is **lerped** toward a yaw/pitch-offset target
  (`camera.position.lerp(camTargetPos, min(1, 6*dt))`) — a *weighted, lagged*
  follow.
- `camera.lookAt()` every frame targets the subject's **live, undamped**
  position — no lag on where you're looking.

That combination is what reads as "connected to the subject" rather than
floaty free-cam: the camera visibly takes a moment to catch up in position,
but never feels like it's looking at a stale target. `CameraRig.tsx` now
reproduces exactly that split (`camera.position.lerp` at a tuned rate,
`camera.lookAt` on a live target each frame), re-tuned for SOLACE's scale
(distance 6.4 vs their 6.2, height 2.6 — close to their 2.6 by coincidence,
confirming their base numbers were a reasonable starting point for this kind
of third-person distance).

**Explicitly not reused:** pointer lock, mouse-**delta**-driven yaw
(`e.movementX`), and yaw being the single value that drives both camera
*and* movement direction (in SRI-07 the "drone" always faces the camera's
yaw — that's an FPS-adjacent coupling incompatible with "mouse alone orbits,
independent of where the explorer is walking"). SOLACE's azimuth instead
comes from `useMouseOrbit` — absolute mouse **position** across the window,
no click/drag/lock — and the explorer's own facing continues to interpolate
independently toward its movement direction.

Also recalibrated for "calm, weighted, not excessive": azimuth/pitch
sensitivity reduced (1.9→1.5 / 1.1→0.8), pitch range narrowed slightly, and
the position-follow damping loosened (was an azimuth/pitch/distance-space
damping before; now it's a direct position-space lerp, matching the
reference's actual mechanism, at a slightly heavier rate for the "weighted"
feel you asked for).

## 5. Environment composition (not density)

Reworked `vegetationLayout.ts` around three explicit depth bands instead of
raising counts uniformly:

- **Foreground** (z 14–22, near spawn): new zones using two newly-added
  assets — `plant_bushLarge.glb` and `grass_leafsLarge.glb` (both from the
  already-approved Nature Kit, ~40KB combined) — placed close to the camera
  on both sides (`nearCamera` x-bias) to actually frame the opening shot,
  plus a couple of close flat rocks.
- **Midground**: tree-cluster zones tightened (`clusterStrength: 'tight'`
  raises the noise-field threshold and lowers the "leak" probability, so
  clumps are fewer and denser rather than lightly perturbed scatter) —
  reads as deliberate groups either side of the trail with a visibly open
  corridor down the middle.
- **Background**: boundary-thicket counts raised and a genuinely new piece —
  `DistantMountains.tsx` now also scatters a **non-playable forest belt**
  (`utils/distantForest.ts`) reusing the already-loaded pine geometries
  (zero extra asset cost) in a band beyond the stream, so the horizon reads
  as forest mass rather than isolated silhouette trees.

## 6. Lighting / sky / atmosphere

- Ridge layers (`DistantMountains.tsx`): 4→5 layers, first one pulled closer
  (z -70→-52) and tripled in visual weight (height 15→21, amplitude 9→13),
  scaling up through the back layers — reads as real mountain mass instead
  of a thin line.
- Added 3 cheap transparent "haze card" planes at increasing depth for
  layered mist, and softened/cooled the fog and hemisphere-sky colors so
  distant scenery cools/desaturates while the foreground stays natural
  (`LIGHTING.hemiSky` shifted toward pale blue, `fogColor` desaturated) —
  addresses "don't make everything orange" directly.
- Sun repositioned slightly lower/warmer (`sunColor` → `#ffcf8f`), tone
  mapping exposure raised a touch (1.05→1.12) for richer golden highlights
  without a post-processing pass.
- Added a free/cheap CSS radial-gradient vignette overlay (`.solace-vignette`
  in `styles.css`) for restrained color grading — no GPU post-processing
  stack added.

## Files changed/added in this patch

```
public/assets/models/Textures/colormap.png   NEW  — the missing character texture
public/assets/models/bush-large.glb           NEW  — foreground framing
public/assets/models/grass-leafs-large.glb    NEW  — foreground framing
src/constants.ts                              MODIFIED — camera/lighting/model-offset tuning
src/components/Explorer.tsx                   MODIFIED — animation state machine + orientation fix
src/components/CameraRig.tsx                  MODIFIED — reworked follow feel
src/components/Vegetation.tsx                 MODIFIED — registers 2 new species
src/components/DistantMountains.tsx           MODIFIED — stronger ridges + forest belt + haze
src/utils/vegetationLayout.ts                 MODIFIED — foreground zone + tighter clustering
src/utils/distantForest.ts                    NEW  — background forest-mass scatter helper
src/App.tsx                                   MODIFIED — exposure + vignette overlay
src/styles.css                                MODIFIED — vignette styles
```

Untouched and preserved as confirmed-working: terrain generation/grounding,
the trail spline, the stream shader, the bridge, the loading screen, the
intro UI, keyboard input, and `useMouseOrbit` itself (only the constants it
reads from changed).

## What to test locally, in order

1. `npm install && npm run dev` — first real build/type-check.
2. **Character**: should now show full color (cap/shirt/pants/shoes), face
   away from the spawn camera into the meadow, and visibly idle-sway/walk/
   run as you move and sprint.
3. **Camera**: move the mouse with no clicking — orbit should feel weighted
   but not sluggish. If it still feels off, the single most impactful knob
   is `CAMERA.positionDamping` in `constants.ts` (lower = heavier/slower).
4. **Environment**: the opening view should now have visible near-camera
   framing (bushes/grass either side), readable tree clusters with open
   ground between them, and a noticeably taller/thicker mountain backdrop
   with a hint of forest mass beyond the stream.
5. **Performance**: the forest belt and haze cards are new draw calls —
   watch the frame rate on a mid-range machine; if it dips, the forest belt
   counts (`forestBeltTall`/`forestBeltRound` in `DistantMountains.tsx`) are
   the first thing to trim.
