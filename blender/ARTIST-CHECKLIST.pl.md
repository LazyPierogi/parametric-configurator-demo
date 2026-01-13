# Lista kontrolna (szybka)

1. **Setup** – Blender 4.x → Alt+P na `setup-curtain-scene.py`. Kolekcje: `Pleat_wave_drape`, `Pleat_wave_sheer`, `Pleat_flex`, `Pleat_double_flex`.
2. **Model** – Każdą rodzinę modeluj osobno. Szerokość = bezszwowy tile, wysokość = 2 m. Dodaj charakterystyczne detale.
3. **UV** – Unwrap do 0–1. Test offset 50 % w osi X (zero szwów). Normale na zewnątrz.
4. **Światło** – Zostaw domyślny setup. Do bake’u `translucency` włącz backlight zgodnie z workflow.
5. **Bake** – Uruchom `bake-all-maps.py`. W `blender/baked_maps/{family}/` znajdziesz `pleatRamp/occlusion/translucency/normal`.
6. **Wave split** – `wave-sheer` ma mieć jaśniejszą `translucency` i delikatniejszą rampę niż `wave-drape`.
7. **Flex** – Sprawdź mocne X w headerze, głębokie cienie pinch, czyste przekątne.
8. **Double-flex** – Gęsta podwójna warstwa, najciemniejsze AO, minimalna wariacja.
9. **QA** – Każda mapa: 1024×2048, histogram 0.06–0.94, offset OK, normal jasnoniebieska, brak artefaktów.
10. **Dostawa** – Kopiuj do `public/textures/canvas/{family}/`, uzupełnij `texture-specs.json`, spakuj foldery + JSON, wyślij.
