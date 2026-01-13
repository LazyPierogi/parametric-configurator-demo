# Blender Toolkit — Curtain Wizard

## Co tu jest?

- `setup-curtain-scene.py` – instant scena (kamera, światła, kolekcje).  
- `bake-all-maps.py` – automatyczny bake czterech map na raz.  
- `ARTIST-BRIEF.md / .pl` – skrócony brief (10 punktów).  
- `PLEAT-REFERENCE-SPECS.md / .pl` – skrót wymiarów i charakteru fałd.  
- `texture-specs.json` – wpisujemy realne parametry tile po bake’u.

## Pleat families (4)

| Kod | Użycie | Opis |
|-----|--------|------|
| `wave-drape` | heavy / blackout | Miękkie S, mała transmisja |
| `wave-sheer` | lekkie firany | Wyższa przepuszczalność, mniej cienia |
| `flex` | zasłony falujące | X-pinched header + szeroki brzuch |
| `double-flex` | formalne heavy | Gęsta podwójna fałda |

Każdy folder końcowy: `public/textures/canvas/{kod}/`.

## Mapy per family

```
pleatRamp.png    # 16-bit grayscale, linear
occlusion.png    # 16-bit grayscale, linear
translucency.png # 16-bit grayscale, linear
normal.png       # 8-bit RGB, tangent OpenGL
```

Rozdzielczość: **1024 × 2048 px**. Szerokość = pełny cykl fałd (musi tile’ować w poziomie). Wysokość = 2 m drop.

## Workflow w skrócie

1. Blender 4.x → Alt+P na `setup-curtain-scene.py`.  
2. Modeluj geometrię w odpowiedniej kolekcji (`Pleat_wave_drape`, …).  
3. Sprawdź UV (0–1, brak szwów, offset test 50 %).  
4. Alt+P na `bake-all-maps.py` (skrypt sam przejdzie rodziny).  
5. Skrypt tworzy `blender/baked_maps/{family}/…`.  
6. Skopiuj pliki do `public/textures/canvas/{family}/`.  
7. Uzupełnij wpis w `texture-specs.json` (ilość pleatów, header %, textureScalePx).  
8. Zrób QA: offset, histogram, test normal mapy w viewport.

## QA checklist (skrót)

- Bezszwowy tile w osi X.  
- Histogram 0.06–0.94 (brak klipów).  
- Normal map light-blue, żadnych artefaktów.  
- `translucency` dla `wave-sheer` pokazuje więcej światła niż `wave-drape`.

W razie wątpliwości → pełny workflow w `BLENDER-WORKFLOW.md` lub wersja PL.*** End Patch
