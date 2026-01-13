# Referencje fałd (skrót)

Parametry wspólne: mapy 1024 × 2048 px, szer. tile 1,0 m, drop 2,0 m, UV 0–1, bezszwowo w osi X. Kamera ortho, Cycles, setup ze skryptu.

| Rodzina | Zastosowanie | Pleatów / tile | Header | Max głębokość | Notatki |
|---------|--------------|----------------|--------|---------------|---------|
| `wave-drape` | ciężkie zasłony / blackout | 9 | 15 % wysokości, zbite | 45 mm | Miękkie S, niska transmisja, mocne cienie w dolinach |
| `wave-sheer` | firany / voile | 9 | 12 %, luźniejsze | 30 mm | Smukłe fałdy, wysoka transmisja, jaśniejszy ramp |
| `flex` | klasyczne wave | 9 | 12 % header + 8 % transition | 55 mm | Ostry X w headerze (szpara 2–3 mm), cylindryczny brzuch |
| `double-flex` | formalne heavy | 17 (podwójna warstwa) | 10 % | front 35 mm, back 25 mm | Gęsta podwójna struktura, najciemniejsze AO, minimalna wariacja |

## Cel map

- `pleatRamp` – zakres 0.18–0.92. `wave-sheer` najjaśniejszy, `double-flex` najciemniejszy.  
- `occlusion` – bez czystej czerni; `double-flex` ≈0.15, `wave-sheer` ≈0.35.  
- `translucency` – `wave-sheer` ≫ `wave-drape`; `flex` średnio; `double-flex` nisko.  
- `normal` – Tangent OpenGL, jasnoniebieska baza, brak odwróconych kanałów.

## Kontrola per rodzina

- **Wave-drape** – trzymaj mocne cienie i zwarty header.  
- **Wave-sheer** – rozjaśnij ramp + AO, przepuść światło przez brzuch.  
- **Flex** – X ma być ostre, diagonalne ramiona czyste, cienie pinch ≈0.1.  
- **Double-flex** – równy rytm, tylna warstwa przesunięta o pół fałdy, AO czyste między warstwami.
