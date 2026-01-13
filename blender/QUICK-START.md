# Blender Quick Start (5 min)

Goal: przygotować **16 PNG** (4 mapy × 4 pleat families) dla renderera zasłon.

## 1. Setup

```
Blender 4.x
File → Save As → curtain_pleats.blend
Text Editor → setup-curtain-scene.py → Alt+P
```

Skrypt tworzy kolekcje: `Pleat_wave_drape`, `Pleat_wave_sheer`, `Pleat_flex`, `Pleat_double_flex`.

## 2. Model

- `wave-drape` – miękkie S dla ciężkich tkanin, mocne cienie.  
- `wave-sheer` – delikatne fałdy, więcej światła.  
- `flex` – X-pinched header, szeroki brzuch.  
- `double-flex` – gęsta podwójna warstwa.

Każda kolekcja: szerokość tile 1 m, drop 2 m, UV 0–1.

## 3. Bake

```
Text Editor → bake-all-maps.py → Alt+P
```

W folderze `blender/baked_maps/{family}/` pojawią się:  
`pleatRamp.png`, `occlusion.png`, `translucency.png`, `normal.png` (1024×2048).

## 4. QA

- Offset 50 % w X → brak szwów.  
- Histogram 0.06–0.94.  
- `wave-sheer` ma najjaśniejszą `translucency`, `double-flex` najciemniejszą.  
- Normal map = jasnoniebieska, zielony kanał dodatni.

## 5. Delivery

```
cp blender/baked_maps/*/*.png public/textures/canvas/{family}/
```

Zaktualizuj `texture-specs.json` (`pleatsPerTile`, `headerBandPct`, `textureScalePx`, `variantCount`). Spakuj foldery + JSON, wyślij.

To tyle — pełne szczegóły w `ARTIST-BRIEF.md`.*** End Patch
