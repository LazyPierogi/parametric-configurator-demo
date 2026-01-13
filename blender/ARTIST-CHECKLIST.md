# Artist Checklist (Fast)

1. **Setup** – Blender 4.x → Alt+P on `setup-curtain-scene.py`. Confirm collections: `Pleat_wave_drape`, `Pleat_wave_sheer`, `Pleat_flex`, `Pleat_double_flex`.
2. **Model** – Build each pleat family in its collection. Keep width = seamless tile, height = 2 m. Add unique fold detail per family.
3. **UV** – Unwrap to 0–1. Test offset 50 % on X (no seams). Normals outwards.
4. **Lighting** – Use scene defaults. For translucency bake enable backlight pass as per workflow.
5. **Bake** – Run `bake-all-maps.py`. Expect four folders in `blender/baked_maps/{family}/` with `pleatRamp/occlusion/translucency/normal`.
6. **Wave split** – Ensure `wave-sheer` has brighter translucency and softer ramp than `wave-drape`.
7. **Flex** – Check strong X-pinched header, deep pinch shadows, clean diagonals.
8. **Double-flex** – Dense double layer, darkest AO, minimal variation.
9. **QA** – For each map: 1024×2048, histogram 0.06–0.94, offset test OK, normal map light-blue, no artefacts.
10. **Delivery** – Copy to `public/textures/canvas/{family}/`, update `texture-specs.json`, zip folders + JSON, share.
