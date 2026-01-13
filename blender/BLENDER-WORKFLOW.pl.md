# Workflow w Blenderze (szczegóły w pigułce)

## 0. Setup jednorazowy

1. Blender 4.x → zapisz jako `curtain_pleats.blend`.  
2. Text Editor → `setup-curtain-scene.py` → Alt+P.  
3. Dostępne kolekcje: `Pleat_wave_drape`, `Pleat_wave_sheer`, `Pleat_flex`, `Pleat_double_flex` + gotowe materiały i kamera ortho.

## 1. Modelowanie

| Kolekcja | Charakter | Max głębokość | Uwagi |
|----------|-----------|---------------|-------|
| wave_drape | ciężka zasłona | 45 mm | header zbity, cienie mocne |
| wave_sheer | firana | 30 mm | header luźny, dużo światła |
| flex | wave z X-headerem | 55 mm | szpara 2–3 mm, ostre przekątne |
| double_flex | formalne podwójne | 35 mm / 25 mm | druga warstwa offset 0.5 pleaty |

- Szerokość tile 1 m, wysokość 2 m, UV 0–1.  
- Array modifier pomaga utrzymać rytm fałd.  
- Normale na zewnątrz, brak overlapów.

## 2. UV + materiał

- `UV → Pack Islands` (margin 0).  
- W Shader Editor są już tekstury docelowe: pleatRamp, occlusion, translucency, normal. Niczego nie zmieniaj nazwą.

## 3. Bake

1. Zaznacz obiekty w danej kolekcji.  
2. Text Editor → `bake-all-maps.py` → Alt+P.  
3. Skrypt zapisze cztery mapy do `blender/baked_maps/{family}/`.  
4. Czas (GPU): wave rodziny ~5 min, flex ~7 min, double-flex ~10 min.

## 4. Kontrola rodzin

- **wave-drape** – ramp ciemniejszy, occlusion głęboki, translucency nisko.  
- **wave-sheer** – ramp delikatny, occlusion jasny, translucency bardzo jasna.  
- **flex** – X wyraźne, pinch prawie czarny, belly płynne.  
- **double-flex** – dwie warstwy widoczne, najciemniejsze AO, prawie brak wariacji.

## 5. QA

1. Offset 50 % w osi X → zero szwów.  
2. Histogram 0.06–0.94.  
3. Normal mapa jasnoniebieska, zielony kanał dodatni (OpenGL).  
4. Porównaj `wave-sheer` vs `wave-drape` – translucent ma być wyraźnie jaśniejsza.

## 6. Eksport

```
cp blender/baked_maps/wave-drape/*.png public/textures/canvas/wave-drape/
cp blender/baked_maps/wave-sheer/*.png public/textures/canvas/wave-sheer/
cp blender/baked_maps/flex/*.png public/textures/canvas/flex/
cp blender/baked_maps/double-flex/*.png public/textures/canvas/double-flex/
```

Zaktualizuj `texture-specs.json` (pleatsPerTile, headerBandPct, textureScalePx, variantCount=1).

## 7. Dostawa

Spakuj cztery foldery + JSON, dołącz `.blend` na poprawki i wyślij. W razie pytań → `ARTIST-BRIEF.pl.md`.
