# Blender Workflow (Detailed but short)

## 0. Setup once

1. Blender 4.x → save as `curtain_pleats.blend`.  
2. Text Editor → `setup-curtain-scene.py` → Alt+P.  
3. Collections created:  
   - `Pleat_wave_drape`  
   - `Pleat_wave_sheer`  
   - `Pleat_flex`  
   - `Pleat_double_flex`

Scene already has ortho camera, sun, fill, Cycles settings, and material slots with bake images.

## 1. Modeling targets

| Collection | Key notes | Depth profile |
|------------|-----------|---------------|
| `wave_drape` | Heavy drape, compact header | 45 mm max, deep troughs |
| `wave_sheer` | Sheer, loose header | 30 mm max, gentle troughs |
| `flex` | Sharp X header, belly body | Pinch 2–3 mm, body 55 mm |
| `double_flex` | Dual layer, formal | Front 35 mm, back 25 mm |

- Width covers one tile (array modifier count as needed).  
- Height = 2 m.  
- Keep geo clean, no overlaps, normals facing out.

## 2. UV & materials

1. Unwrap each mesh to 0–1 square.  
2. In UV editor run `UV → Pack Islands` (margin 0).  
3. Confirm material slot already references images named: pleatRamp, occlusion, translucency, normal. Do not rename.

## 3. Baking

1. Select collection root.  
2. Text Editor → `bake-all-maps.py` → Alt+P.  
3. Script iterates families, switches bake images, and saves to `blender/baked_maps/{family}/`.  
4. Expected runtime (GPU): wave families ~5 min, flex ~7 min, double-flex ~10 min.

## 4. Per-family checks

- **Wave-drape** – troughs darker than flex, translucency low.  
- **Wave-sheer** – translucency bright, ramp highlights soft.  
- **Flex** – X arms sharp, pinch near black (≈0.1), belly smooth.  
- **Double-flex** – dual layer visible, AO darkest of all, minimal variation.

## 5. QA routine

1. Open each map in UV editor or external tool.  
2. Offset 50 % on X → seams? if yes, fix UV/geo.  
3. Histogram: values within 0.06–0.94.  
4. Normal map: green channel positive (OpenGL).  
5. Compare `wave_sheer` vs `wave_drape` translucency – sheer must be brighter.

## 6. Export to project

```
cp blender/baked_maps/wave-drape/*.png public/textures/canvas/wave-drape/
cp blender/baked_maps/wave-sheer/*.png public/textures/canvas/wave-sheer/
cp blender/baked_maps/flex/*.png       public/textures/canvas/flex/
cp blender/baked_maps/double-flex/*.png public/textures/canvas/double-flex/
```

Update `texture-specs.json` with measured `pleatsPerTile`, `headerBandPct`, `textureScalePx`, `variantCount`.

## 7. Pack & deliver

Zip the four folders + specs JSON. Keep `.blend` for revisions. Let engineering know when upload is complete.
