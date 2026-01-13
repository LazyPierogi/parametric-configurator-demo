# Curtain Wizard – Brief dla Artysty (10 punktów)

1. **Deliverables**  
   Cztery rodziny fałd × cztery mapy = 16 PNG. Rodziny: `wave-drape`, `wave-sheer`, `flex`, `double-flex`. Mapy: `pleatRamp.png` (16 bit, linear), `occlusion.png` (16 bit, linear), `translucency.png` (16 bit, linear), `normal.png` (8 bit RGB, tangent OpenGL).

2. **Rozdzielczość / skala**  
   1024 × 2048 px. Szerokość = jeden bezszwowy cykl fałd, wysokość = pełna kurtyna 2 m. UV w 0‑1, bez szwów na osi X.

3. **Geometria**  
   `wave-drape`: miękkie S dla ciężkich tkanin. `wave-sheer`: delikatne, przepuszczające światło. `flex`: ostre X w headerze + szeroki brzuch. `double-flex`: gęsta, formalna podwójna fałda. Każdy typ w osobnej kolekcji.

4. **Setup**  
   Blender 4.x → otwórz `setup-curtain-scene.py` → Alt+P. Skrypt tworzy kamerę, światła, kolekcje i ustawienia renderu.

5. **Światło**  
   Używaj słońca + fill ze skryptu. Ekspozycja neutralna (bez przepaleń). Do bake’u `translucency` włącz backlight zgodnie z workflow.

6. **Bake**  
   `bake-all-maps.py` (Alt+P) dla każdej rodziny. Wyjście trafia do `blender/baked_maps/{family}/`. Cycles, 512 próbek, 16 bit tam gdzie trzeba.

7. **Kontrola jakości**  
   Offset 50 % w X → brak szwów. Histogram 0.06–0.94 (bez czystej czerni/bieli). Normal mapa ma być jasnoniebieska, bez zielono-fioletowych plam.

8. **Kopiowanie plików**  
   Wrzucamy do `public/textures/canvas/{family}/`. Nazwy zostawiamy dokładnie jak wyżej. Zero dodatkowych sufiksów, zero spacji.

9. **Specyfikacja JSON**  
   `python bake-all-maps.py --specs` lub ręczna edycja `texture-specs.json`: wpisz `pleatsPerTile`, `headerBandPct`, `textureScalePx`, `variantCount` (na start 1).

10. **Dostawa**  
   Spakuj cztery foldery + zaktualizowany JSON i prześlij standardowym kanałem. `.blend` zachowaj na ewentualne poprawki.
