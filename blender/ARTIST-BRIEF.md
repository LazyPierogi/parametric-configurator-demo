# Curtain Wizard – Artist Brief (Ultra Short)

1. **What to deliver**  
   Four pleat families × four maps = 16 PNGs. Families: `wave-drape`, `wave-sheer`, `flex`, `double-flex`. Maps per family: `pleatRamp.png` (16‑bit, linear), `occlusion.png` (16‑bit, linear), `translucency.png` (16‑bit, linear), `normal.png` (8‑bit RGB, tangent OpenGL).

2. **Resolution & scale**  
   1024 × 2048 px. Width covers one seamless pleat cycle, height is full 2 m drop. Keep UVs in 0‑1 and tile cleanly on X.

3. **Geometry targets**  
   `wave-drape`: soft S‑curve for heavy fabrics. `wave-sheer`: gentler folds, higher light pass. `flex`: sharp X‑pinched header with generous belly. `double-flex`: tight formal double stack. Model each in its own collection.

4. **Scene setup**  
   Open Blender 4.x, run `setup-curtain-scene.py` (Alt+P). It builds camera, lights, collections, render settings.

5. **Lighting**  
   Use the provided sun + fill from the setup script. Keep exposure neutral (no burns). For translucency bakes enable backlight as instructed in the workflow.

6. **Baking**  
   Run `bake-all-maps.py` once per family (Alt+P). Script outputs maps to `blender/baked_maps/{family}/`. Renders use Cycles, 512 samples, 16‑bit where needed.

7. **Quality bars**  
   Check 50 % offset in X for seams. Histogram range 0.06–0.94 (no pure white/black). Normal map should look light-blue, no green/purple patches.

8. **File drop**  
   Copy baked files to `public/textures/canvas/{family}/`. Keep naming exactly as above. No extra suffixes, no spaces.

9. **Specs JSON**  
   Run `python bake-all-maps.py --specs` or edit `texture-specs.json` entry to record: `pleatsPerTile`, `headerBandPct`, `textureScalePx`, `variantCount` (start at 1).

10. **Delivery pack**  
   Zip the four family folders + updated JSON and ship via your usual channel. Keep the `.blend` if revisions are needed.
