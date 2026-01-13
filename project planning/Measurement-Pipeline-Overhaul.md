# Przebudowa pipeline'u pomiarowego

Ten dokument opisuje etapową przebudowę pipeline'u pomiarowego dla nowego curtain‑first flow.

Uzupełnia, a nie zastępuje:
- `project planning/NEW-FLOW-PLAN.md` (plan ogólny, kamienie milowe A–D)

Skupiamy się wyłącznie na **dokładności pomiaru** oraz współpracy:
- `/estimate` ↔ `/api/measure` ↔ measurement cache ↔ `/configure`
- polygon ↔ maska ↔ geometria zasłon.

---

## 0. Przed przebudową (stan obecny)

**Stan:**
- `/estimate` (new flow) przy uploadzie:
  - startuje **pomiar ściany** (bez polygona) **i** segmentację równolegle.
  - potem opcjonalnie uruchamia pomiar z polygonem.
- `/configure`:
  - przy wejściu z `/estimate` dostaje `flow.measurement`, ale
  - i tak odpala **nowy** `/api/measure` z polygonem z `/configure` i nadpisuje wymiary.
- Maska z `/api/segment` nie jest używana w samym pomiarze, tylko później w geometrii (`mask:missing_or_rejected`).

**ASCII – przed przebudową**

```text
/estimate (upload)
  ├─► startAnalysis()
  │    ├─► /api/measure (no polygon) ──► meas#1 (wall-wide)
  │    └─► /api/segment ───────────────► mask (IndexedDB)
  │
  ├─► użytkownik zaznacza polygon
  │    └─► startPolygonMeasurement()
  │          └─► /api/measure (with polygon?) ─► meas#2 (curtain-ish)
  │
  └─► użytkownik potwierdza modal
       └─► storeFlowState { measurement: meas#?, segmentKey, polygon }
            └─► router.push(/configure)

/configure (mount)
  ├─► peekFlowState() → flow.measurement → baseCm
  ├─► restore mask from cache or re-/api/segment
  └─► curtain-first effect
        └─► /api/measure (with configure polygon)
              └─► meas#3
                   ├─► overwrite baseCm + flowMeasurementMeta
                   └─► geometra zasłon (mask, polygon)
```

Kluczowe problemy:
- wiele pomiarów (meas#1/2/3) dla jednego zdjęcia,
- brak jednego „źródła prawdy” dla wymiarów,
- `mask:missing_or_rejected` → brak spójnego fallbacku na polygon.

---

## 1. Etap 1 — jedno źródło prawdy dla pomiaru

**Cel:** 1 foto + 1 polygon ⇒ 1 kanoniczny pomiar cm.

Powiązane z:
- `NEW-FLOW-PLAN.md` → Milestone C „UI Beta” (curtain‑first flow, polygon tool).

**Plan:**
- `/estimate` (new flow):
  - upload **tylko** segmentuje (`/api/segment`), nie robi `/api/measure`.
  - użytkownik rysuje polygon → klika przycisk „Zmierz” → `startPolygonMeasurement()` woła `/api/measure(photoDataUri, polygon)` i produkuje `meas#P`.
  - measurement cache używa wersjonowanego klucza w stylu `signature::polyHash::provider::model::flowMode::mpipeV2`.
- `/configure` (curtain‑first):
  - jeżeli przyszliśmy z `/estimate`, traktuje `flow.measurement` (`meas#P`) jako **źródło prawdy**:
    - ustawia `baseCm` (wymiary ściany w cm) i **nie odpala** ponownie `/api/measure` w prod.
  - opcjonalny pomiar w `/configure` → tylko jako **debug** (diagnostyka), za flagą i bez zmiany `baseCm`.

**ASCII – Etap 1 (docelowo)**

```text
/estimate (upload nowego flow)
  ├─► /api/segment ─────────► mask (IndexedDB)
  └─► użytkownik zaznacza polygon (4 rogi)
        └─► startPolygonMeasurement()
              └─► /api/measure(photoDataUri, polygon)
                    └─► meas#P (canonical)
                          ├─► saveMeasurementToCache(key=signature::polyHash::provider::model::flowMode::mpipeV2)
                          └─► storeFlowState { measurement: meas#P, segmentKey, polygon }
                               └─► router.push(/configure)

/configure (curtain-first)
  ├─► peekFlowState() → baseCm = flow.measurement (meas#P)
  ├─► restore mask from cache
  └─► brak nowego /api/measure w produkcji (tylko opcjonalna ścieżka debug)
```

Efekt:
- jeden pomiar per foto+polygon (`meas#P` = wymiary ściany w cm),
- spójny measurement cache z uwzględnieniem providera/modelu/trybu flow,
- brak nadpisywania manualnie zaakceptowanych wymiarów,
- spójne `measurementId` / klucz `signature::…` logowane w całym przepływie (łatwy debug end‑to‑end).

---

## 2. Etap 2 — polygon + maska (geometria zasłon)

**Cel:** stabilne przeliczanie wysokości zasłony z maski + polygona.

Powiązane z:
- `NEW-FLOW-PLAN.md` → ryzyka „State Desync” i „Cache Reset (Stealth Phase)”.

**Plan:**
- Dla curtain-first flow ustawić domyślnie `CURTAIN_BOX_HEIGHT_SOURCE='mask'` za env‑flagą.
- Utrzymać aktualny algorytm w `/configure` (wallVerticalBounds + wallBoxBounds), ale:
  - złagodzić progi `MASK_HEIGHT_RATIO_MIN/MAX`, żeby dobre przypadki nie wpadały w `mask:height_ratio_out_of_range`.
  - kiedy maska zawiedzie (`mask:missing_or_rejected`), zastosować fallback:
    - policzyć `fracPoly = polygonHeightNorm` (maxY−minY w [0,1]),
    - użyć `effectiveHeightFraction = fracPoly` zamiast pełnej ściany,
    - oznaczyć to w diagnostics np. `mask:fallback_poly_only`.
- Traktować maskę jako **soft‑hint** do doprecyzowania top/bottom ściany:
  - na tym etapie użyć jednego prostego zestawu reguł (span, minimalne coverage, ratio do bboxa),
  - mocno logować, kiedy maska jest użyta, odrzucona lub zastąpiona polygonem, zamiast dokładania wielu heurystyk.

**ASCII – Etap 2 (geometria)**

```text
/configure
  ├─► baseCm (meas#P)  [z Etapu 1]
  ├─► mask + wallVerticalBounds (top/bottom ściany)
  ├─► curtain polygon (corners z /configure)
  │
  ├─► compute fracWall
  │     = (polyBottomWithinWall - polyTopWithinWall)
  │
  ├─► if OK (span & ratio w normie):
  │       curtainHeight = baseCm.h * fracWall
  │       warnings: []
  │   else if mask broken but polygon OK:
  │       curtainHeight = baseCm.h * fracPoly
  │       warnings: ['mask:fallback_poly_only', ...]
  │   else:
  │       curtainHeight = baseCm.h  (full wall)
  │       warnings: ['mask:missing_or_rejected', ...]
  │
  └─► Measurement Diagnostics zapisuje geom + ostrzeżenia
```

Efekt:
- maska poprawia dokładność tam, gdzie działa,
- polygon daje sensowny fallback, zamiast losowej pełnej ściany.

---

## 3. Etap 3 — strategia providerów (AI1_PROVIDER + Qwen/Genkit/noreref)

**Cel:** ustawić prosty, przewidywalny stack providera dla AI #1, w którym **Qwen jest domyślnym źródłem cm**, Genkit pełni rolę fallbacku/legacy, a `noreref` zostaje wyłącznie eksperymentalny.

**Powiązane z:**
- `NEW-FLOW-PLAN.md` → sekcje o AI #1 (measurement) i eksperymentach z providerami.
- `AGENTS.md` → opis AI #1 i curtain‑first flow.

**Kontrakt:**
- `meas#P` zawsze oznacza **wymiary ściany w cm** (`wallWidthCm`, `wallHeightCm`).
- Geometria zasłon (Etap 2) przelicza te wartości na wysokość/szerokość zasłory; żaden provider nie zwraca już „curtainHeightCm” używanego dalej w geometrii.

**Stan:**
- Historycznie AI1_PROVIDER wskazywał na Genkit (Gemini/OpenAI).
- Ścieżka Qwen wall×bbox (opposite‑wall estimator) jest zaimplementowana i ma lepszą dokładność ściany (MAPE ~10% w dotychczasowych testach).
- `noreref` (local CV + HF) pozostaje niestabilny dla części scen.

**Plan (stack v1 po pivocie):**
- **3a. Prod‑default: Qwen (wall‑first)**
  - Globalnie `AI1_PROVIDER` domyślnie wskazuje na Qwen (`AI1_PROVIDER=qwen`).
  - `provider='qwen'` liczy **pełną przeciwległą ścianę** (bez polygona), a następnie lokalne `measureWithFallback({ base, polygon })` przelicza wynik na cm ściany (`wallWidthCm`/`wallHeightCm`), uwzględniając kadrowanie/polygon.
- **3b. Fallback/legacy: Genkit (googleai/openai)**
  - Genkit (Gemini/OpenAI) pozostaje **głównym fallbackiem** i ścieżką legacy:
    - można go wymusić przez `AI1_PROVIDER=genkit` (np. dla starszych flow lub awaryjnego rollbacku),
    - zwraca `wallWidthCm`/`wallHeightCm` dla całej ściany; polygon/maska są używane tylko lokalnie w geometrii (Etap 2) lub w promptach.
- **3c. `noreref` wyłącznie eksperymentalnie**
  - `provider='noreref'` używany tylko w:
    - CLI / benchmarkach offline (Etap 6 / Milestone D),
    - ewentualnie w debug panelu,
  - nigdy jako prod‑default ani jako automatyczny fallback w runtime.
- **3d. Brak cross‑provider fallbacków w runtime**
  - `measureWithFallback` działa **wewnątrz** jednego providera (np. confidence‑fallback, różne prompty),
  - nie robimy łańcuchów typu „Qwen → potem noreref → potem VLM/Genkit” w produkcji; takie porównania tylko w benchmarku offline.

**ASCII – Etap 3 (logika providera)**

```text
/api/measure(photoDataUri, polygon, provider?)
  ├─► resolvedProvider = provider ?? env.AI1_PROVIDER  // 'qwen' domyślnie
  │
  ├─► if resolvedProvider === 'qwen':
  │      base = QwenOppositeWall(photoDataUri)
  │      meas = measureWithFallback({ base, polygon })
  │
  ├─► else if resolvedProvider === 'noreref':      // eksperymentalny only
  │      meas = measureNoReference(imageBuffer, { polygon, exifCandidates })
  │
  └─► else:  // 'genkit' (googleai/openai)
         meas = GenkitVLM(photoDataUri, polygon)
         // zawsze wall cm; polygon używany tylko w promptach / sanity‑checkach

  └─► return {
         wallWidthCm,
         wallHeightCm,
         warnings,
         confidencePct,
         provider,
         model,
       }
```

**Efekt:**
- prosty switch env‑owy z Qwen jako domyślnym źródłem cm (AI1_PROVIDER=qwen),
- Genkit służy jako kontrolowany fallback/legacy path, a `noreref` pozostaje tylko eksperymentalny,
- łatwe logowanie metadanych providera (provider/model/AI1_PROVIDER/flowMode) do Measurement Diagnostics.

---

## 4. Etap 4 — UX i gating (measurement vs segmentation)

**Cel:** UX jasno komunikuje, co jest gotowe:
- nie pokazujemy wymiarów zanim measurement nie jest w sensownym stanie,
- CTA nie wprowadza w błąd (loader, disabled, itp.), a segmentacja może pracować w tle.

**Powiązane z:**
- `NEW-FLOW-PLAN.md` → Milestone C „UI Beta” (guard rails dla brakujących danych).

**Plan:**
- `/estimate`:
  - modal z wymiarami (`confirmOpen`) otwieramy, gdy:
    - curtain‑measurement (Etap 1) jest gotowy.
  - w momencie otwarcia:
    - jeśli segmentacja (`segStatus==='success' && segmentKey`) jest gotowa:
      - CTA „Przejdź do konfiguratora” jest aktywne,
    - jeśli segmentacja nadal trwa:
      - CTA jest disabled + loader „Analizujemy ścianę…”, segmentacja kończy się w tle.
  - jeżeli segmentacja przekroczy rozsądny timeout:
    - pokaż komunikat z opcjami „Spróbuj ponownie segmentacji” / „Przejdź dalej bez podglądu AI”.
- `/configure`:
  - jeśli nie uda się odtworzyć maski/measurementu z flow/cache, w curtain‑first flow redirectujemy z powrotem na `/estimate` zamiast udawać, że coś wiemy.

**ASCII – Etap 4 (wysokopoziomowo)**

```text
/estimate
  ├─► curt_meas_ready?   (Etap 1)
  ├─► seg_ready?         (segmentKey & mask)
  │
  ├─► if curt_meas_ready:
  │      show dimensions modal
  │      if seg_ready:
  │          CTA enabled
  │      else:
  │          CTA disabled + "Analizujemy ścianę…"
  │   else:
  │      (loader w obrębie markowania / CTA)
  │
  └─► after confirm → /configure

/configure
  ├─► try restore {mask, meas} from flow/cache
  └─► if fail & USE_CURTAIN_FIRST_FLOW:
         redirect /estimate  (no half-broken configure)
```

Efekt:
- user nie widzi „magicznych” zmian wymiarów pomiędzy kolejnymi ekranami,
- trudne przypadki (brak maski/cache) są jasne i naprawialne,
- segmentacja nie blokuje pokazywania wymiarów, ale w kontrolowany sposób blokuje przejście dalej.

---

## 5. Etap 5 — Diagnostics i logging (przygotowanie benchmarku)

**Cel:** mieć kompletne logi i narzędzia, żeby później (Milestone D) zmierzyć błąd <10% bez przebudowy kodu.

**Powiązane z:**
- `NEW-FLOW-PLAN.md` → Milestone C/D (Measurement Diagnostics, rollout),
- `apps/web/lib/measurement-observer.ts` → Measurement Diagnostics panel,
- `project planning/900-Accuracy-Quick-Wins.md` / `901-EXIF-Integration-Strategy.md`.

**Plan:**
- Rozszerzyć Measurement Diagnostics o:
  - `measurementId` / klucz cache (`signature::polyHash::provider::model::flowMode::mpipeV2`),
  - `provider`, `model`, `AI1_PROVIDER`, `flowMode` (legacy/new),
  - informację o cache hit/miss,
  - stan maski/polygona (`maskStatus`, `effectiveHeightFraction`, ostrzeżenia).
- Dodać eksport CSV/JSON:
  - ostatnie N (np. 40) pomiarów z Diagnostics,
  - w formacie zdatnym do offline benchmarku (patrz Milestone D).
- Wykorzystać istniejące katalogi `measure-debug-*` jako seed do pierwszych logów.

**ASCII – Etap 5 (high‑level)**

```text
MeasurementObserver
  ├─► onMeasurement(meas#P, context)
  │      ├─► enrich with { provider, model, cacheKey, flowMode, maskStatus, ... }
  │      └─► append to ring‑buffer (max 40 entries)
  │
  └─► exportToCsv() / exportToJson()
         └─► plik wejściowy dla benchmark.mjs (Milestone D)
```

Efekt:
- wszystkie etapy 1–4 są mierzalne (provider, cache, mask/polygon fallback),
- benchmark w Milestone D nie wymaga dopisywania logiki w prod,
- ta sama telemetria służy zarówno debugowi jak i QA.

## 6. Milestone D — Benchmark & rollout (<10% błędu)

Ten etap jest częścią `NEW-FLOW-PLAN.md`, a nie samego kodu measurement‑pipeline’u, ale dla pełni obrazu:

**Cel:** twardo zweryfikować, że nowy pipeline spełnia kryterium <10% błędu dla większości scen.

**Plan (wysokopoziomowo):**
- Zbiór testowy 40–50 zdjęć:
  - zróżnicowane EXIF (ogniskowe, dystanse),
  - różne typy okien i „brudnych” scen (rośliny, grzejniki, meble),
  - ground truth szerokości i wysokości w cm + zapisane polygon’y.
- Offline benchmark (korzystający z eksportów z Etapu 5):
  - porównanie co najmniej: Qwen (prod‑default), Genkit (fallback/legacy), opcjonalnie `noreref`,
  - policzenie mediany / p90 błędu osobno dla szerokości i wysokości.
- Acceptance criteria:
  - <10% błędu dla 85–90% zdjęć,
  - potwierdzenie, że Qwen może pozostać domyślnym providerem (lub świadoma decyzja o korekcie stacku, jeśli dane temu przeczą).

Szczegóły datasetu i procesu są rozwijane w `NEW-FLOW-PLAN.md` oraz dokumentach 900/901.

## Checklist wdrożenia

Poniżej skrótowa checklist'a do wdrożenia etapów 0–6.

- **0. Przed przebudową (stan obecny)**
  - [x] Potwierdź na kilku zdjęciach, że pipeline zachowuje się jak w diagramie "ASCII – przed przebudową".

- **1. Etap 1 — jedno źródło prawdy dla pomiaru**
  - [x] Na `/estimate` w nowym flow Qwen mierzy ścianę równolegle z segmentacją (bez polygona).
  - [x] `startPolygonMeasurement` używa heurystyki maski do obliczenia wymiarów polygona jako frakcji ściany (Qwen wall cm × polygon/wall fraction).
  - [x] FlowState przechowuje kanoniczny pomiar i polygon.
  - [x] W `/configure` nie odpalaj `/api/measure`, jeśli przychodzimy z `/estimate` i mamy `flow.measurement`; dodano guard w efekcie pomiarowym który pomija API call gdy `flowMeasurementMeta` ma ważne wymiary (2025-11-28).
  - [x] Measurement Diagnostics loguje oba źródła (`estimate-curtain`, `configure-box`).

- **2. Etap 2 — polygon + maska (geometria zasłon)**
  - [x] Zaimplementowano `analyzeWallMaskPng()` i `computePolygonDimensionsWithHeuristics()` w `apps/web/lib/mask-heuristics.ts`.
  - [x] Heurystyka używa p10/p90 percentyli zamiast mediany, aby ignorować kolumny z meblami.
  - [ ] **Problem:** Finalna maska (wall+window+attached) zawiera elementy pierwszego planu (meble), które obcinają wykryte granice ściany. Rozwiązanie: użyć maski `wall` lub `wall+attached_on_wall` zamiast combined. Do zrobienia gdy czas pozwoli.
  - [x] Fallback `mask:fallback_poly_only` działa gdy maska zawodzi.

- **3. Etap 3 — strategia providerów (AI1_PROVIDER + Qwen/Genkit/noreref)**
  - [x] Ustaw globalny prod‑default `AI1_PROVIDER` na Qwen — zmieniono default w `packages/shared/src/env.ts`, `.env.example`, `.env.production` na `qwen` (2025-11-28). Genkit (googleai) służy jako fallback gdy Qwen zawiedzie.
  - [x] Uporządkuj `measureFromImage` — Qwen i Genkit zawsze zwracają `wallWidthCm`/`wallHeightCm` dla pełnej ściany; skalowanie polygona realizowane osobno przez `computePolygonDimensionsWithHeuristics` w `/estimate`.
  - [x] Ogranicz `provider='noreref'` — używany tylko gdy explicite żądany, nie jest częścią auto-fallback chain (Qwen → googleai ↔ openai).

- **4. Etap 4 — UX i gating (measurement vs segmentation)**
  - [x] Na `/estimate` otwieraj modal wymiarów po gotowym pomiarze; segmentacja może dobiegać w tle — modal otwiera się po `measureStatus='success'`, segmentacja jest async.
  - [x] CTA „Przejdź do konfiguratora" blokuj dopóki segmentacja nie zakończy się sukcesem — `disabled={segStatus === 'pending'}`, z komunikatem `waitSegmentation` i toast.
  - [x] Jasne komunikaty („Analizujemy ścianę…") oraz ścieżka recovery — `waitSegmentation` / `retrySegmentation` + retry button przy błędach.
  - [x] W `/configure` (new flow) przechwytuj nawigację "wstecz" (popstate) i pokazuj dialog ostrzeżenia przed opuszczeniem strony; działa zarówno dla storefront jak i mock provider (2025-11-28).

- **5. Etap 5 — Diagnostics i logging**
  - [x] Rozszerz Measurement Diagnostics o metadane providera/modelu/cache‑key/flowMode/maskStatus — już zapisywane: provider, model, flowMode, source, cacheKey; maskStatus w `warnings` (`heuristics:applied`/`heuristics:fallback`) i `fallbackProvider` (`geometry:mask_heuristics`/`geometry:bbox`).
  - [x] Dodaj eksport CSV/JSON (ostatnie N pomiarów) jako wejście do benchmarku — JSON istniał, CSV dodany (2025-11-28). Plik zawiera: id, createdAt, status, flowMode, source, provider, model, elapsedMs, wallWidthCm, wallHeightCm, confidencePct, usedFallback, fallbackProvider, polygonWidthPct, polygonHeightPct, polygonAreaPct, warnings, error, cacheKey.

- **6. Milestone D — Benchmark & rollout**
  - [ ] Przygotuj zróżnicowany zbiór testowy 40–50 zdjęć z ground truth + polygon (zgodnie z NEW‑FLOW‑PLAN i dokumentami 900/901).
  - [ ] Odpal offline benchmark (Qwen vs Genkit vs opcjonalnie `noreref`) na eksporcie z Etapu 5.
  - [ ] Na podstawie mediany/p90 błędu potwierdź, że Qwen może pozostać domyślnym providerem (lub świadomie zaktualizuj stack, jeśli dane temu przeczą) i oceń gotowość do szerszego rollout’u.
