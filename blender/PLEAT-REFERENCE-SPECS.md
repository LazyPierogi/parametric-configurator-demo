# Pleat Reference (Quick Table)

All families share: 1024 × 2048 px maps, 1.0 m tile width, 2.0 m drop, UV 0–1, seamless on X. Camera = ortho, Cycles, same rig from setup script.

| Family | Use-case | Pleats / tile | Header band | Max depth | Notes |
|--------|----------|---------------|-------------|-----------|-------|
| `wave-drape` | Heavy / blackout drapes | 9 | 15 % height, gathered | 45 mm | Soft S curve, minimal light bleed, strong occlusion at troughs |
| `wave-sheer` | Sheer / voile | 9 | 12 %, relaxed | 30 mm | Slim folds, higher transmission, softer shadows, keep ramp brighter |
| `flex` | Classic wave | 9 | 12 % header + 8 % transition | 55 mm | Sharp X-pinched header (2–3 mm gap), cylindrical belly, crisp diagonals |
| `double-flex` | Formal heavy | 17 (double layer) | 10 % | 35 mm front, 25 mm back | Dense dual stack, darkest AO, variation minimal |

### Map targets

- `pleatRamp`: 0.18–0.92 range. Wave-sheer brightest, double-flex darkest.  
- `occlusion`: No pure black; double-flex troughs ≈0.15, wave-sheer ≈0.35.  
- `translucency`: Wave-sheer ≫ wave-drape. Flex moderate; double-flex low.  
- `normal`: Tangent OpenGL, light blue base. Watch for flipped greens.

### Checklist per family

**Wave-drape** – ensure trough shadows stay deep, header folds remain compact.  
**Wave-sheer** – lighten ramp + AO, translucency should glow through belly.  
**Flex** – highlight X arms, keep diagonals razor sharp, pinch shadows near 0.1.  
**Double-flex** – enforce even cadence, back layer offset half pleat, AO clean between layers.
