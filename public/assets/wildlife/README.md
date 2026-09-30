# Kenney Cube Pets

Selected unchanged GLBs from the supplied `kenney_cube-pets_1.0.zip` and its shared `Textures/colormap.png`. The included pack license names the release Cube Pets (2.0), CC0; see LICENSE.txt.

Actual pack inventory: beaver, bee, bunny, cat, caterpillar, chick, cow, crab, deer, dog, elephant, fish, fox, giraffe, hog, koala, lion, monkey, panda, parrot, penguin, pig, polar, tiger. There is no duck model.

All 24 models contain transform animations named `static`, `idle`, `walk`, `run`, `eat`, `dance`, `gesture-positive`, and `gesture-negative`; they have no skinned meshes. SOLACE uses native `idle`, `walk`, and `eat`, plus gentle procedural bee hovering/wing movement. Geometry, materials and the atlas are shared between instances.

Used: cow, bunny, cat, chick, deer, fox, beaver, bee. Individual full model heights relative to the 1.04m explorer are in `src/utils/wildlife.ts`; these deliberately differ by species.
