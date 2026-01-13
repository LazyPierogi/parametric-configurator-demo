# Curtain Wizard Pricing Algorithm

This document explains how the mock catalog provider (`packages/core/src/catalog/providers/mock.ts`) calculates consumption and price quotes. The same steps will be mirrored by the production provider so the UI always receives comparable metadata.

## Inputs

The provider receives a `CurtainConfig` with:

- `widthCm`, `heightCm`: finished (on-the-rail) curtain dimensions for the entire treatment.
- `segments`: number of panels.
- `segmentWidthsCm` (optional): array of individual panel widths for asymmetric configurations. When provided, overrides equal division of `widthCm`.
- `fabricId`, `pleatId`, `hemId`: user selections.
- `colorId` (optional): selected fabric color variant. Colors are attributes of a fabric, not separate items.
- optional `services` (add-ons).

Each fabric contributes metadata (`packages/core/src/catalog/mock/data.ts`):

- `fabricWidthCm`,
- `isDoubleWidth`, `isRailroadable`. - not used now, returns null, kept for backward compatibility.
- `allowancesCm` (top/bottom/side/stitch), `minOrderIncrementCm`.
- `verticalRepeatCm`, `repeatType`.
- `shrinkagePct`.
- `fullnessByPleat` overrides.
- Optional surcharges via pricing rules.
- **New (Task 904)**: `style` ('basic' | 'natural'), `colorCategory` ('bright' | 'grey' | 'dark' | 'colored' | 'patterned' | 'intensive' | 'natural' | 'brown') for filtering.

### Variants (color)

- Fabrics can define `colors: string[]` and an optional `textureByColor: Record<string,string>` for visualization.
- Pricing rules may optionally target a specific color via `colorId` (see `MockPricingRule`).
- Color selection never changes the SKU; it only modifies pricing and visualization. The cart payload includes `options.colorId` for storefront display and pricing rules.

## Step-by-step Calculation

1. **Sanitise Inputs**
   - Ensure width, height, segments are ≥ 1.
   - Resolve pleat fullness (`fullnessByPleat` → defaults).

2. **Curtain Constraints** (`computeFabricConstraints`)
   - **Updated production model (2025-10-02):** All fabric constraints removed.
   - Fabrics can be sewn/stitched together horizontally to achieve any width.
   - Fabrics are always cut vertically within their height (no maximum height limit).
   - `isRailroadable` and `isDoubleWidth` are deprecated but kept for backward compatibility.
   - Function returns `null` for both `maxCurtainHeightCm` and `maxPanelWidthCm`.

3. **Finished Dimensions Per Panel**
   - If `segmentWidthsCm` is provided: use individual widths for each panel (asymmetric configuration).
   - Otherwise: `widthPerPanel = widthCm / segments` (symmetric, equal panels).
   - Apply constraints per segment: `clampedWidth = min(width, maxPanelWidthCm)`.
   - `finishedDrop = min(heightCm, maxCurtainHeightCm?)`.

4. **Cut Length (Drop) — Updated Task 904**
   - **Top allowance**: Fixed at 5cm (default)
   - **Bottom allowance**: Dynamic based on user's hem selection:
     - `hem-2cm` → 2cm bottom allowance
     - `hem-10cm` → 10cm bottom allowance
   - If `verticalRepeatCm > 0`, round up to the repeat (half-drop adds one extra repeat).

5. **Widths Calculation — Updated Task 904** (formerly "Railroad Decision")
   - **All fabrics are now cut vertically** (railroad logic removed).
   - **New hem allowances applied to width**:
     - **Side hem**: 2cm per segment edge (left + right = 4cm total per segment)
     - **Stitch hem**: 2cm per stitch line (where fabric widths are sewn together)
   - **Per-segment calculation with allowances**:
     1. Add side allowances: `segWidthWithSides = segmentWidth + 4cm`
     2. Calculate required flat width: `requiredFlat = segWidthWithSides × fullness`
     3. Calculate preliminary widths needed: `widthsNeeded = ceil(requiredFlat / fabricWidthCm)`
     4. Add stitch allowances: `stitchLines = widthsNeeded - 1`, `stitchTotal = stitchLines × 2cm`
     5. Recalculate with stitches: `requiredFlatWithStitches = (segWidthWithSides + stitchTotal) × fullness`
     6. Final widths: `widthsPerSegment[i] = ceil(requiredFlatWithStitches / fabricWidthCm)`
   - Multiple widths are sewn together horizontally to create the required panel width.
   - **Total widths**: `numWidths = sum(widthsPerSegment)` — accurately reflects asymmetric configurations.

6. **Fullness & Flat Width**
   - `requiredFlatWidthPerPanel = panelWidth × fullness`.
   - Total linear cm = `sum(widthsPerSegment[i] × cutDrop)` for all segments.

7. **Shrinkage & Rounding**
   - Multiply by `(1 + shrinkagePct/100)`.
   - Round up to the fabric's `minOrderIncrementCm`.

8. **Pricing**
   - Fabric cost = `linearMetres × pricePerMLinearMinor` (fallbacks to cm pricing when absent).
   - Labour = `numWidths × laborPerWidthMinorByPleat` (defaults defined in `domainDefaults.ts`).
   - Add optional surcharges (pleat, hem, fabric) and any selected services.
   - If a matching rule includes `colorId`, it takes precedence over fabric-only rules. Rule matching order by specificity:
     1) fabric + color + pleat + hem
     2) fabric + color + pleat
     3) fabric + color
     4) fabric

9. **Metadata**
   Each quote returns `providerMetadata` including:

   - `totalLinearCm`, `numWidths`, `widthsPerPanel` (average for display), `fullness`, `appliedWidthCm`, `appliedHeightCm`.
   - `widthsPerSegment` (array, only present for asymmetric panels): number of fabric widths needed per segment.
   - `segmentWidthsCm` (array, only present for asymmetric panels): actual width in cm per segment after constraints.
   - `appliedPanelWidthCm`, `requestedPanelWidthCm`.
   - `maxCurtainHeightCm`, `maxPanelWidthCm` (both null with new model), `constraintsHit` (width/height booleans).
   - For the fabric line item: `cutDropCm`, `allowancesCm`, `shrinkagePct`, `widthsPerPanel`, `widthsPerSegment`, `repeatCm`, `repeatType`, `colorId` (if provided).
   - **Removed:** `canRailroad` (deprecated).

10. **Errors**
    - Unknown fabric → error.
    - UI clamps dimensions to avoid fabric-limit errors; production logic should do the same. (Currently the mock provider does not throw when height > bolt width because the UI prevents that configuration.)

## RIDEX Pricing Model

The application supports an alternate pricing model sourced from an external vendor (RIDEX). This model is enabled via an environment switch and is implemented in the storefront catalog provider.

### Activation (environment switch)

- `NEXT_PUBLIC_PRICING_MODEL=internal|ridex` (default: `internal`)

When set to `ridex`, `StorefrontCatalogProvider.priceQuote()` uses the RIDEX calculation branch.

### Input data from Magento (parent attributes)

RIDEX prices are provided on the **parent** product as three attributes (strings representing **PLN major units**):

- `price_flex`
- `price_double_flex`
- `price_wave`

These values represent **price per 1 meter of finished curtain width (on the rail)**, independent of curtain height. They are assumed to already include fullness/labor for the given pleat family.

### Pleat mapping and fallback

The selected `pleatId` is mapped to a requested price key:

- `flex` → `price_flex`
- `doubleFlex` (also accepted: `doubleflex`, `double_flex`, `double-flex`) → `price_double_flex`
- otherwise → `price_wave`

If the requested price attribute is missing/empty, the provider falls back to `price_wave`.

The quote metadata records both:

- `requestedPriceKey`
- `appliedPriceKey`

This makes it explicit when the fallback was used.

### Calculation (RIDEX)

RIDEX pricing ignores height for fabric cost (height is still kept for UI display and metadata).

1. Determine segment widths:
   - If `segmentWidthsCm[]` is provided and matches `segments`, use it.
   - Otherwise split evenly.
2. Sum total width:
   - `totalWidthCm = sum(segmentWidthsCm)`
   - `widthMetres = totalWidthCm / 100`
3. Parse `pricePerMWidth` from the chosen Magento attribute:
   - `pricePerMWidth = Number(priceStr.replace(',', '.'))`
4. Compute fabric cost (minor units):
   - `fabricCostMinor = round(widthMetres * pricePerMWidth * 100 * fabricMultiplier)`
5. Add selected services (unchanged from internal model):
   - `totalMinor = fabricCostMinor + servicesMinor`

### Quote metadata (RIDEX)

RIDEX quotes populate only the fields meaningful for RIDEX; internal consumption fields (bolts, cut drop, etc.) are not computed by this model.

Key fields:

- `providerMetadata.totalLinearCm = totalWidthCm`
- `providerMetadata.linearMetres = widthMetres`
- `providerMetadata.segmentWidthsCm` (only if per-segment widths were used)
- `providerMetadata.appliedWidthCm = totalWidthCm`
- `providerMetadata.appliedHeightCm = heightCm` (display-only for RIDEX)
- `providerMetadata.pricing = { model: 'ridex', requestedPriceKey, appliedPriceKey, pricePerMWidth, priceStr }`

The same `pricing` block is also attached to the `fabric` breakdown line item.

### Cart quantity convention

The cart payload continues using the existing convention:

- `quantity = totalLinearCm * 0.01` (so 1cm = 0.01 qty)

For RIDEX, `totalLinearCm` represents the total **finished width** in cm (not fabric consumption length), so qty effectively represents linear meters of width.

### Code locations

- Pricing switch env validation: `packages/shared/src/env.ts`
- Magento GraphQL attributes fetch: `apps/web/lib/magento-client.ts`
- Mapping storefront product → fabric provider metadata: `packages/core/src/catalog/storefront/mappers.ts`
- RIDEX pricing calculation + metadata: `packages/core/src/catalog/providers/storefront.ts`
- Cart payload formatting (uses `quote.providerMetadata.totalLinearCm`): `packages/core/src/catalog/providers/storefront.ts`

### Debugging

On `/configure`, enable the existing debug UI and use the **Pricing Diagnostics** panel. It surfaces:

- raw Magento `price_*` values for the selected fabric,
- requested vs applied price key (fallback visibility),
- computed width (cm/m), multipliers, expected vs actual fabric line cost,
- full quote JSON copy for comparison.

## UI Summary (Task 861)

The configurator sidebar renders the metadata highlighted above:

- Linear metres ordered.
- Bolt widths cut.
- **Widths per panel** (number of fabric widths sewn together).
- Tight/fullness ratio.
- Applied vs requested sizes with constraint notes.
- Allowances, shrinkage, repeat info.
- **Stitch line visualization:** Shows where fabric widths are sewn together, calculated individually per segment based on `widthsPerSegment[]`.

This provides a single source of truth for consumption details and validates that pricing + cart payloads share the same numbers.

## Asymmetric Panel Calculation (Task 902+)

**Problem:** The UI allows dragging segments to different widths (e.g., 50cm + 222cm), but the old pricing logic divided total width equally, causing incorrect bolt counts and stitch line positions.

**Solution:** Per-segment calculation using `segmentWidthsCm[]`.

**Example (Linen 300):**
- Fabric: 300cm wide, 2% shrinkage, 2.2× fullness (wave pleat)
- Configuration: 2 segments, 50cm (left) + 222cm (right) = 272cm total

**Old (incorrect) calculation:**
1. Average: `272 / 2 = 136cm` per panel
2. Widths per panel: `ceil(136 × 2.2 / 300) = 1`
3. Total: `1 × 2 = 2 bolts` ❌ (should be 3!)

**New (correct) calculation:**
1. Effective fabric width: `300 × (1 - 0.02) / 2.2 = 294 / 2.2 = 133.6cm`
2. Left segment: `ceil(50 / 133.6) = 1 width`
3. Right segment: `ceil(222 / 133.6) = 2 widths`
4. Total: `1 + 2 = 3 widths` ✓
5. First stitch line appears when right panel reaches `~134cm` (needs 2 widths)
6. Maximum on 2 bolts: `2 × 133.6 = 267cm` total coverage

**Benefits:**
- Accurate material consumption for asymmetric layouts
- Correct stitch line visualization per segment
- Proper bolt count as segments are dragged
- Matches real-world fabric cutting patterns

## repeatType Parameter

The `repeatType: 'straight' | 'half-drop'` parameter controls how patterned fabrics align when multiple widths are sewn together:

- **`'straight'`**: Pattern repeats at the same vertical position across all widths (simple alignment)
- **`'half-drop'`**: Pattern on adjacent widths is offset by half the repeat height (creates diagonal/brick effect, hides seams)

This parameter is **essential for patterned fabrics** and must be retained. It affects cutting length calculations to ensure proper pattern alignment at stitch lines.

## Next Steps

- Ensure the production provider mirrors these fields, including color-aware rule matching and passing `options.colorId` to checkout.
- Extend cart payloads to pass through the same metadata for checkout. `/api/cart/add` already builds the GraphQL mutation (see `packages/clients/src/magento.ts`); wire the storefront provider to call the real endpoint.

---

# Algorytm Wyceny Curtain Wizard (Polish Translation)

Ten dokument wyjaśnia, jak mock catalog provider (`packages/core/src/catalog/providers/mock.ts`) oblicza zużycie materiału i wycenia zasłony. Te same kroki będą odzwierciedlone w produkcyjnym providerze, aby UI zawsze otrzymywał porównywalne metadane.

## Dane Wejściowe

Provider otrzymuje `CurtainConfig` zawierający:

- `widthCm`, `heightCm`: **gotowe wymiary zasłony** (na szynie) dla całego zestawu
- `segments`: **liczba równych paneli** 
- `fabricId`, `pleatId`, `hemId`: **wybory użytkownika** (tkanina, fałdy, podwijka)
- `colorId` (opcjonalne): **wariant koloru tkaniny**  
  💡 *Kolory to atrybuty tkaniny, nie osobne produkty*
- opcjonalne `services`: **usługi dodatkowe** (montaż, pomiar itp.)

Każda tkanina dostarcza metadane (`packages/core/src/catalog/mock/data.ts`):

- `fabricWidthCm`: **szerokość rolki tkaniny** (standardowo 140-300cm)
- `isDoubleWidth`: **czy tkanina jest podwójnej szerokości** (≥280cm) - nie używane, zwraca null, zachowane dla kompatybilności. 
- `isRailroadable`: **czy można kroić w poprzek** (wzór się nadaje)- nie używane, zwraca null, zachowane dla kompatybilności. 
- `allowancesCm`: **naddatki** (góra/dół) na haki i podwijkę
- `minOrderIncrementCm`: **minimalny przyrost zamówienia** (np. co 10cm)
- `verticalRepeatCm`: **powtórzenie wzoru** (dla dopasowania wzoru między panelami)
- `repeatType`: **typ powtórzenia** (`'straight'` lub `'half-drop'`)
- `shrinkagePct`: **procent skurczu** po praniu/konserwacji
- `fullnessByPleat`: **nadpisania współczynnika marszczenia** dla różnych typów fałd
- Opcjonalne **dopłaty** przez reguły cenowe

### Warianty (kolor)

- Tkaniny mogą definiować `colors: string[]` oraz opcjonalny `textureByColor: Record<string,string>` do wizualizacji  
  💡 *Kolory to tylko opcje wizualne, nie zmieniają SKU*
- Reguły cenowe mogą celować w konkretny kolor przez `colorId` (patrz `MockPricingRule`)  
  💡 *Np. biały może być droższy niż beżowy*
- Wybór koloru **nie zmienia SKU**, tylko cenę i wizualizację  
  💡 *Koszyk zawiera `options.colorId` do wyświetlania i reguł cenowych*

## Proces Obliczania (Krok po Kroku)

### 1. **Walidacja Danych Wejściowych**
   - Upewnij się, że szerokość, wysokość, segmenty są ≥ 1
   - Rozwiąż współczynnik marszczenia (`fullnessByPleat` → wartości domyślne)
   
   💡 *Przykład: jeśli użytkownik wybrał pleat "Triple Pinch", system pobiera fullness=2.5x*

### 2. **Ograniczenia Tkaniny** (`computeFabricConstraints`)
   - **Nowy model produkcji (2025-10-02):** Wszystkie ograniczenia usunięte  
     💡 *Tkaniny można zszyć w poziomie do dowolnej szerokości*
   - Tkaniny są zawsze **krojone pionowo** w obrębie swojej wysokości  
     💡 *Brak limitu wysokości - krojenie w rolce, nie w poprzek*
   - `isRailroadable` i `isDoubleWidth` są **przestarzałe** (zachowane dla kompatybilności)  
     💡 *Funkcja zwraca `null` dla obu limitów*

### 3. **Gotowe Wymiary na Panel**
   - `widthPerPanel = widthCm / segments` z uwzględnieniem max szerokości panelu  
     💡 *Przykład: 360cm ÷ 3 segmenty = 120cm na panel*
   - `finishedDrop = min(heightCm, maxCurtainHeightCm?)`  

### 4. **Długość Cięcia (Drop)**
   - Dodaj naddatki góra/dół (`allowancesCm`)  
     💡 *Przykład: 250cm gotowe + 10cm góra + 15cm dół = 275cm cięcie*
   - Jeśli `verticalRepeatCm > 0`, **zaokrąglij w górę do powtórzenia wzoru**  
     💡 *Przykład: 275cm przy wzorze 32cm → 9 powtórzeń = 288cm*
   - Dla half-drop dodaj **jedno dodatkowe powtórzenie**  
     💡 *To zapewnia dopasowanie wzoru między panelami*

### 5. **Obliczanie Pasów** (dawniej "Decyzja Railroad")
   - **Wszystkie tkaniny są teraz krojone pionowo** (logika railroad usunięta)  
     💡 *Nie ma już cięcia w poprzek - tylko pionowe cięcie w rolce*
   - Oblicz `widthsPerPanel = ceil(requiredFlatWidthPerPanel / fabricWidthCm)`  
     💡 *Przykład: panel 120cm × fullness 2.5 = 300cm płasko ÷ rolka 150cm = 2 pasy*
   - Wiele pasów jest **szytych razem poziomo**, aby utworzyć wymaganą szerokość panelu  
     💡 *Linie szwów są widoczne w podglądzie konfiguratora*

### 6. **Marszczenie i Szerokość Płaska**
   - `requiredFlatWidthPerPanel = widthPerPanel × fullness`  
     💡 *To ile tkaniny trzeba przed zmarszczeniem*
   - `total linear cm = widthsPerPanel × cutDrop × panels`  
     💡 *Przykład: 2 pasy × 288cm drop × 3 panele = 1728cm (17.28m)*

### 7. **Skurcz i Zaokrąglanie**
   - Pomnóż przez `(1 + shrinkagePct/100)`  
     💡 *Przykład: 25.92m × 1.03 = 26.70m (przy 3% skurczu)*
   - Zaokrąglij w górę do `minOrderIncrementCm` tkaniny  
     💡 *Przykład: 26.70m → 27m (przy przyroście co 10cm)*

### 8. **Wycena**
   - **Koszt tkaniny** = `linearMetres × pricePerMLinearMinor`  
     💡 *Przykład: 27m × 45 PLN/m = 1215 PLN*
   - **Robocizna** = `numWidths × laborPerWidthMinorByPleat`  
     💡 *Przykład: 9 szerokości × 25 PLN/szerokość = 225 PLN*
   - Dodaj opcjonalne **dopłaty** (pleat, hem, fabric) i wybrane **usługi**
   - **Kolejność dopasowywania reguł** (od najbardziej szczegółowej):
     1. tkanina + kolor + pleat + hem  
        💡 *Najprecyzyjniejsza reguła, np. "kremowa chmurka z triple pinch"*
     2. tkanina + kolor + pleat  
        💡 *Np. "kremowa chmurka z dowolną podwijką"*
     3. tkanina + kolor  
        💡 *Np. "kremowa chmurka z dowolnymi fałdami"*
     4. tkanina  
        💡 *Najprostsza reguła, np. "chmurka w dowolnym kolorze"*

### 9. **Metadane**
   Każda wycena zwraca `providerMetadata` zawierające:
   
   **Główne dane:**
   - `totalLinearCm`: **całkowite metry liniowe** zamówione  
     💡 *To pojawi się w koszyku i podsumowaniu*
   - `numWidths`: **liczba szerokości rolki** (dla robocizny)
   - `fullness`: **współczynnik marszczenia** zastosowany
   - `appliedWidthCm`, `appliedHeightCm`: **rzeczywiste wymiary** po ograniczeniach
   - `appliedPanelWidthCm`: **rzeczywista szerokość panelu**
   - `requestedPanelWidthCm`: **żądana szerokość panelu** (może różnić się od applied)
   
   **Ograniczenia:**
   - `maxCurtainHeightCm`: **maks. wysokość zasłony** dla tej tkaniny
   - `maxPanelWidthCm`: **maks. szerokość panelu** dla tej tkaniny
   - `constraintsHit`: **które ograniczenia zostały osiągnięte** (width/height booleans)  
     💡 *UI pokazuje ostrzeżenie: "Maksymalna wysokość dla tej tkaniny"*
   
   **Szczegóły tkaniny:**
   - `cutDropCm`: **długość cięcia** (z naddatkami)
   - `allowancesCm`: **naddatki** użyte
   - `shrinkagePct`: **procent skurczu**
   - `repeatCm`: **powtórzenie wzoru**
   - `repeatType`: **typ powtórzenia** (`straight`/`half-drop`)
   - `colorId`: **wybrany kolor** (jeśli podano)

### 10. **Błędy**
   - Nieznana tkanina → **błąd**  
     💡 *System nie pozwoli na nieprawidłowe fabricId*
   - UI **ogranicza wymiary**, aby uniknąć błędów limitów tkaniny  
     💡 *Np. nie pozwoli przeciągnąć Wall Box powyżej max wysokości*
   - Produkcja powinna robić to samo  
     💡 *(Obecnie mock provider nie rzuca błędem gdy wysokość > szerokość rolki, bo UI to zapobiega)*

## Model cen RIDEX

W aplikacji istnieje alternatywny model wyceny (RIDEX), w którym ceny pochodzą bezpośrednio z Magento i są liczone wyłącznie po szerokości zasłony.

### Włączenie (przełącznik środowiskowy)

- `NEXT_PUBLIC_PRICING_MODEL=internal|ridex` (domyślnie: `internal`)

Gdy ustawione na `ridex`, `StorefrontCatalogProvider.priceQuote()` przechodzi na gałąź RIDEX.

### Dane wejściowe z Magento (atrybuty parenta)

Dla każdego materiału (produkt parent) Magento udostępnia trzy atrybuty (stringi w **PLN, jednostki główne**):

- `price_flex`
- `price_double_flex`
- `price_wave`

Każda z tych cen oznacza **cenę za 1 metr szerokości gotowej zasłony (na szynie)**, niezależnie od wysokości. Zakładamy, że cena zawiera już wszystkie narzuty dla danego typu fałd (fullness, szycie, itp.).

### Mapowanie fałd (pleat) i fallback

Wybrany `pleatId` mapujemy na żądany klucz ceny:

- `flex` → `price_flex`
- `doubleFlex` (akceptowane też: `doubleflex`, `double_flex`, `double-flex`) → `price_double_flex`
- w pozostałych przypadkach → `price_wave`

Jeśli żądany atrybut jest pusty/brakujący, stosujemy fallback do `price_wave`.

W metadanych quote zapisujemy oba klucze:

- `requestedPriceKey`
- `appliedPriceKey`

To pozwala jednoznacznie stwierdzić, czy fallback został użyty.

### Jak liczymy cenę (RIDEX)

W RIDEX koszt tkaniny zależy tylko od szerokości (wysokość pozostaje widoczna w UI i trafia do metadanych, ale nie wpływa na cenę tkaniny).

1. Wyznaczamy szerokości segmentów:
   - jeśli `segmentWidthsCm[]` jest podane i pasuje długością do `segments`, używamy go,
   - w przeciwnym razie dzielimy szerokość równo.
2. Sumujemy szerokość całkowitą:
   - `totalWidthCm = sum(segmentWidthsCm)`
   - `widthMetres = totalWidthCm / 100`
3. Pobieramy i parsujemy cenę za 1m szerokości z Magento:
   - `pricePerMWidth = Number(priceStr.replace(',', '.'))`
4. Liczymy koszt tkaniny (w minor units):
   - `fabricCostMinor = round(widthMetres * pricePerMWidth * 100 * fabricMultiplier)`
5. Dodajemy usługi dodatkowe (bez zmian względem modelu internal):
   - `totalMinor = fabricCostMinor + servicesMinor`

### Metadane zwracane przez quote (RIDEX)

RIDEX uzupełnia tylko metadane sensowne dla RIDEX; pola dotyczące zużycia tkaniny z modelu internal (bolty, cut drop, itp.) nie są liczone.

Kluczowe pola:

- `providerMetadata.totalLinearCm = totalWidthCm`
- `providerMetadata.linearMetres = widthMetres`
- `providerMetadata.segmentWidthsCm` (tylko jeśli użyto per-segment widths)
- `providerMetadata.appliedWidthCm = totalWidthCm`
- `providerMetadata.appliedHeightCm = heightCm` (informacyjnie dla UI)
- `providerMetadata.pricing = { model: 'ridex', requestedPriceKey, appliedPriceKey, pricePerMWidth, priceStr }`

Ten sam blok `pricing` jest też dopięty do linii `fabric` w breakdown.

### Konwencja qty w koszyku

Payload koszyka zachowuje dotychczasową konwencję:

- `quantity = totalLinearCm * 0.01` (czyli 1cm = 0.01 qty)

Dla RIDEX `totalLinearCm` oznacza sumaryczną **szerokość gotowej zasłony** w cm (nie długość zużytej tkaniny), więc qty odpowiada metrom szerokości.

### Gdzie jest kod

- Walidacja env switch: `packages/shared/src/env.ts`
- Pobieranie atrybutów Magento: `apps/web/lib/magento-client.ts`
- Mapowanie do `Fabric.providerMetadata.ridex`: `packages/core/src/catalog/storefront/mappers.ts`
- Wycena RIDEX + metadane: `packages/core/src/catalog/providers/storefront.ts`
- Payload koszyka (bazuje na `quote.providerMetadata.totalLinearCm`): `packages/core/src/catalog/providers/storefront.ts`

### Debugowanie

Na `/configure` możesz włączyć debug UI i użyć panelu **Pricing Diagnostics**, który pokazuje:

- raw wartości `price_*` z Magento,
- requested vs applied price key (czy fallback do `wave` zadziałał),
- policzoną szerokość (cm/m), multipliery, expected vs actual koszt tkaniny,
- możliwość skopiowania pełnego JSON-a wyceny.

## Podsumowanie w UI (Task 861)

Panel boczny konfiguratora renderuje powyższe metadane:

- **Metry liniowe** zamówione  
  💡 *"27.0 m tkaniny"*
- **Szerokości rolki** cięte  
  💡 *"9 szerokości"*
- **Stosunek tight/fullness**  
  💡 *"2.5× marszczenie (Triple Pinch)"*
- **Zastosowane vs żądane rozmiary** z notkami o ograniczeniach  
  💡 *"Wysokość: 250cm (max dla tej tkaniny)"*
- **Naddatki, skurcz, repeat info**  
  💡 *"Wzór powtarza się co 32cm (straight)"*

To zapewnia **pojedyncze źródło prawdy** dla szczegółów zużycia i waliduje, że wycena + payloady koszyka dzielą te same liczby.

## Następne Kroki

- Upewnij się, że produkcyjny provider odzwierciedla te pola, włącznie z dopasowywaniem reguł uwzględniających kolor i przekazywaniem `options.colorId` do checkout
- Rozszerz payloady koszyka, aby przekazywały te same metadane do checkout  
  💡 *`/api/cart/add` już buduje mutację GraphQL (patrz `packages/clients/src/magento.ts`); podłącz storefront provider do prawdziwego endpointu*

## Pomocne Komentarze dla Deweloperów

### Gdzie Znaleźć Kod?

1. **Mock Provider** (algorytm wyceny):  
   `packages/core/src/catalog/providers/mock.ts`  
   💡 *Główna logika obliczania metrów i cen*

2. **Dane Testowe** (tkaniny, ceny):  
   `packages/core/src/catalog/mock/data.ts`  
   💡 *Przykładowe tkaniny z wszystkimi parametrami*

3. **Domyślne Wartości** (fullness, robocizna):  
   `packages/core/src/catalog/lib/domainDefaults.ts`  
   💡 *Współczynniki marszczenia dla różnych typów fałd*

4. **Ograniczenia** (max wymiary):  
   `packages/core/src/catalog/lib/constraints.ts`  
   💡 *Helper do obliczania max wysokości/szerokości panelu*

5. **UI Podsumowania** (wyświetlanie metadanych):  
   `apps/web/app/configure/page.tsx`  
   💡 *Panel boczny pokazujący szczegóły wyceny*

### Typowy Przepływ Danych:

```
1. Użytkownik zmienia wymiary Wall Box
   ↓
2. UI wywołuje computeFabricConstraints() → ogranicza przeciąganie
   ↓
3. Użytkownik klika segment (wybiera tkaninę/fałdy)
   ↓
4. UI wywołuje mockProvider.quote(config)
   ↓
5. Provider oblicza (kroki 1-8 powyżej)
   ↓
6. Zwraca { totalMinor, lineItems, providerMetadata }
   ↓
7. UI renderuje podsumowanie w panelu bocznym
   ↓
8. Użytkownik klika "Dodaj do koszyka"
   ↓
9. UI buduje CartInput z metadanymi
   ↓
10. [TODO] Wywołaj /api/cart/add → Magento GraphQL
```

### Kluczowe Koncepcje:

- **Panel** = jedna zasłona/szyba (segment)  
  💡 *Przykład: okno 3-szybowe = 3 panele*

- **Fullness** = współczynnik marszczenia (ile razy więcej tkaniny niż gotowa szerokość)  
  💡 *Przykład: fullness 2.5× → panel 100cm wymaga 250cm tkaniny*

- **Drop** = wysokość zasłony (termin branżowy)  
  💡 *"Cut drop" = wysokość + naddatki*

- **Widths** = szerokości rolki (ile razy trzeba przeciąć rolkę dla jednego panelu)  
  💡 *Przykład: panel wymaga 300cm płasko ÷ rolka 140cm = 3 widths*

- **Repeat** = powtórzenie wzoru dla tkanin wzorzystych (zaokrąglanie w górę aby nie ucinać wzoru)  
  💡 *Przykład: wzór 32cm → zawsze zamów wielokrotność 32cm*

---

## Task 904 Updates — New Hem Calculation & Filters (2025-10-07)

### Summary

Updated the pricing algorithm to use more precise hem allowances and added new fabric filtering options based on vendor requirements.

### Hem Allowances (Updated)

**Old system (pre-Task 904):**
- Single `allowancesCm: { top, bottom }` structure
- Both top and bottom were fixed (typically 10cm each)
- No allowances for side or stitch seams

**New system (Task 904):**
```typescript
allowancesCm: {
  top: 5,        // Fixed: 5cm for rod pocket/header
  bottom: 2|10,  // Dynamic: based on hem selection (hem-2cm or hem-10cm)
  side: 2,       // Fixed: 2cm per edge (4cm total per segment)
  stitch: 2      // Fixed: 2cm per stitch line (1cm per fabric width)
}
```

**Impact on calculations:**
- **Height (drop)**: `cutDrop = finishedHeight + top(5cm) + bottom(2 or 10cm) + repeatRounding`
- **Width**: Now includes side and stitch allowances:
  - Each segment adds 4cm (2cm left + 2cm right)
  - Each stitch line adds 2cm (where fabric widths are sewn together)
  - Formula: `widthWithAllowances = (segWidth + 4cm + stitchLines × 2cm) × fullness`

### New Fabric Filters

**Fabric Types** (replaced old sheer-thin/drape-thick):
- **Light**: Sheers and lightweight drapes
- **Heavy**: Room-darkening drapes
- **Blackout**: Complete light blockage

**Style** (new filter):
- **Basic**: Simple, modern designs
- **Natural**: Organic, textured materials

**Color Category** (new filter):
- **Bright**: Light colors
- **Grey**: Neutral greys
- **Dark**: Deep, rich colors
- **Colored**: Vibrant colors
- **Patterned**: Fabrics with patterns

**Pleating Options** (renamed):
- Wave → Wave (unchanged)
- Microflex → **Flex**
- Tape → **Tab**
- Tunnel → Tunnel (unchanged)
- **Ring** → New option

**Hem Options** (updated):
- Old: `hem-1cm` (1 cm) → New: `hem-2cm` (2 cm)
- Unchanged: `hem-10cm` (10 cm)

**New Service:**
- **Consult Stylist** (`svc-stylist`): Expert fabric and design consultation

### Configurator Section Toggle

New environment variable `NEXT_PUBLIC_CONFIGURATOR_SECTIONS` allows hiding/showing configurator panel sections:
- Available sections: `fabricType`, `fabrics`, `color`, `style`, `colorCategory`, `pleating`, `hem`, `services`, `budgetPerMeter`
- Default: All sections shown except `budgetPerMeter` (hidden per requirement)
- Example: `NEXT_PUBLIC_CONFIGURATOR_SECTIONS=fabricType,fabrics,pleating,hem,services`

### Files Modified

- `packages/core/src/catalog/types.ts` — Extended `allowancesCm` type, added `style` and `colorCategory` fields
- `packages/core/src/catalog/mock/data.ts` — New fabric types, pleats, hems, service, and sample fabrics
- `packages/core/src/catalog/lib/domainDefaults.ts` — Updated default allowances and pleat fullness values
- `packages/core/src/catalog/providers/mock.ts` — Implemented new hem calculation logic
- `packages/core/src/catalog/lib/configuratorSections.ts` — New toggle system (created)
- `packages/core/src/i18n/messages.ts` — Added translations for all new fields
- `.env.example` — Added `NEXT_PUBLIC_CONFIGURATOR_SECTIONS` variable
- `docs/PRICING.md` — This document (updated)

### Migration Notes

**Backward compatibility:**
- Old fabric types (`sheer-thin`, `drape-thick`) kept in i18n for legacy support
- Old pleat IDs still work in fullness calculations (mapped internally)
- Default allowances structure ensures old configs still function

**Breaking changes for new implementations:**
- Hem IDs changed: `hem-1cm` → `hem-2cm`
- Fabric type IDs changed: Use `light`, `heavy`, `blackout` instead of old IDs
- Pleat IDs renamed: `microflex` → `flex`, `tape` → `tab`

**Testing checklist:**
- ✅ New hem allowances reflected in fabric ordered calculation
- ✅ Side and stitch allowances add to horizontal fabric usage
- ✅ Dynamic bottom hem changes with user selection (2cm vs 10cm)
- ✅ New filters (style, colorCategory) work in UI
- ✅ Configurator sections can be toggled via env variable
- ✅ All translations present in EN/PL/UK
- ✅ Legacy fabric/pleat IDs still work for existing orders
