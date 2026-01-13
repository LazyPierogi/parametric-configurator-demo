# Blender Toolkit — Curtain Wizard (PL)

## Zawartość

- `setup-curtain-scene.py` – szybki setup sceny (kamera, światła, kolekcje).  
- `bake-all-maps.py` – automatyczny bake czterech map.  
- `ARTIST-BRIEF.pl.md` – krótkie wytyczne (10 punktów).  
- `PLEAT-REFERENCE-SPECS.pl.md` – najważniejsze wymiary/fałdy.  
- `texture-specs.json` – wypełniamy realnymi parametrami tile po bake’u.

## Rodziny fałd (4)

| Kod | Zastosowanie | Charakter |
|-----|--------------|-----------|
| `wave-drape` | zasłony ciężkie / blackout | miękkie S, duża opacowość |
| `wave-sheer` | firany / lekkie | cięcie cieni, większa transmisja |
| `flex` | klasyczny wave na zasłonach | header X, szeroki brzuch |
| `double-flex` | formalne heavy | gęsta podwójna fałda |

Finalne pliki: `public/textures/canvas/{kod}/`.

## Mapy na rodzinę

```
pleatRamp.png    # 16-bit grayscale, linear
occlusion.png    # 16-bit grayscale, linear
translucency.png # 16-bit grayscale, linear
normal.png       # 8-bit RGB, tangent OpenGL
```

Rozdzielczość 1024 × 2048 px. Szerokość = pełny cykl, wysokość = 2 m drop. UV 0–1, tile w osi X obowiązkowy.

## Workflow (skrót)

1. Blender 4.x → Alt+P na `setup-curtain-scene.py`.  
2. Modeluj fałdy w kolekcjach `Pleat_wave_drape`, `Pleat_wave_sheer`, `Pleat_flex`, `Pleat_double_flex`.  
3. Sprawdź UV + test offset 50 %.  
4. Alt+P na `bake-all-maps.py` (skrypt wypiecze wszystkie rodziny).  
5. Pliki pojawią się w `blender/baked_maps/{family}/`.  
6. Skopiuj do `public/textures/canvas/{family}/`.  
7. Uzupełnij `texture-specs.json` (pleatsPerTile, headerBandPct, textureScalePx, variantCount=1).  
8. QA: offset, histogram, podgląd normal mapy w Blenderze.

## QA skrót

- Brak szwów po przesunięciu 50 % w X.  
- Histogram 0.06–0.94 (bez clip).  
- Normal mapa jasnoniebieska, brak artefaktów.  
- `translucency` dla `wave-sheer` > `wave-drape`.

Więcej szczegółów → `BLENDER-WORKFLOW.pl.md`.*** End Patch
