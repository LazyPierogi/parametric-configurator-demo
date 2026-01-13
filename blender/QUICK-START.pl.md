# Blender – Szybki start (5 min)

Cel: przygotować **16 plików PNG** (4 mapy × 4 rodziny fałd) dla renderera.

## 1. Setup

```
Blender 4.x
File → Save As → curtain_pleats.blend
Text Editor → setup-curtain-scene.py → Alt+P
```

Powstaną kolekcje: `Pleat_wave_drape`, `Pleat_wave_sheer`, `Pleat_flex`, `Pleat_double_flex`.

## 2. Modelowanie

- `wave-drape` – miękkie S dla ciężkich tkanin.  
- `wave-sheer` – delikatne fale, dużo światła.  
- `flex` – header w kształcie X, szeroki brzuch.  
- `double-flex` – gęsta podwójna warstwa.  

Szerokość = bezszwowy tile 1 m, wysokość = 2 m, UV 0–1.

## 3. Bake

```
Text Editor → bake-all-maps.py → Alt+P
```

Każda rodzina dostaje `pleatRamp.png`, `occlusion.png`, `translucency.png`, `normal.png` (1024×2048) w `blender/baked_maps/{family}/`.

## 4. QA

- Offset 50 % w X → brak szwów.  
- Histogram 0.06–0.94.  
- `wave-sheer` ma najjaśniejszą `translucency`; `double-flex` najciemniejszą.  
- Normal mapa jasnoniebieska, zielony kanał dodatni.

## 5. Dostawa

```
cp blender/baked_maps/*/*.png public/textures/canvas/{family}/
```

Uzupełnij `texture-specs.json` (pleatsPerTile, headerBandPct, textureScalePx, variantCount=1). Spakuj foldery + JSON, wyślij.

Więcej szczegółów → `ARTIST-BRIEF.pl.md`.
