# Curtain Wizard — User Journey (Stages 4–6)

## Overview
These stages cover the configuration, add-on selection, and checkout hand-off for Curtain Wizard. They assume a single catalog provider abstraction that can resolve real Magento data in production and structured mock data in development.

## Global Data Principle
- **User expectation:** every visible option (types, fabrics, patterns, colors, pleats, hems, add-ons, pricing, dimensions) is real and orderable.
- **System contract:** all data must come from the Storefront (Magento) GraphQL API when production mode is enabled. Until that integration ships, the app runs in **Debug Data Mode** with schema-compatible mock data so that the UX can be completed end-to-end.

### Acceptance Criteria — Data
- In **production mode**, the configurator fetches price, colors, materials, patterns, dimensions, pleat types, hems, availability, thumbnails, and SKU via the Magento products GraphQL API.
- In **debug mode**, the same UI flow runs against a local/mock catalog that mirrors the production schema and response shape.
- A single **Catalog Provider** interface (feature-flagged) switches between storefront and mock sources without UI changes.
- Filters, thumbnails, price updates, and compatibility rules are always driven by the active provider; no hard-coded option lists live in UI components.

---

## Stage 4 — Real-Time Visualization & Configuration Panel
**User Story:** As a user, I want instant, accurate previews of curtain options on my room photo with filters that never show unavailable choices, so my decisions feel effortless.

### Acceptance Criteria — UX & Data
- If navigation comes from a product page, pre-select that product’s type/fabric; otherwise load the provider default.
- Filters are provider-driven:
  - Fabric density/type (e.g., thin sheer, thick sheer, thin drape, thick drape).
  - Pattern type (plain, patterned, printed custom), with the ability to disable unsupported categories.
  - Specific fabric thumbnails filtered by the current selections and active price range.
  - Pleating options (Wave, Tape, Microflex, Tunnel) showing provider-supplied sketches or imagery.
  - Hem options (1 cm, 10 cm) constrained by provider compatibility rules.
  - Price range slider narrows to combinations available within the range.
- Every selection updates the render immediately and preserves prior choices unless the provider flags incompatibility. In incompatibility cases, surface a “compatible alternatives” chip row.
- Pricing is provider-calculated (or mock-calculated) and reacts instantly to changes.
- Progressive disclosure hides irrelevant controls based on provider flags like `compatiblePleats`, `availableHems`, etc.

---

## Stage 5 — Additional Options
**User Story:** As a user, I want to add optional services in one tap without aggressive upselling.

### Acceptance Criteria — UX & Data
- Optional services are populated from provider data (or mock equivalents):
  - Measurement visit (paid) with tooltip copy and pricing.
  - Curtain rod purchase with description, pricing, and optional compatible rod selector.
  - Professional installation (Warsaw) showing availability notes and cost.
  - Design consultation (Calendly link) opening an overlay while preserving wizard state.
- Selected services persist in the wizard state and appear in the running total and final summary.

---

## Stage 6 — Order & Checkout
**User Story:** As a user, I want a clear summary and seamless hand-off to checkout with nothing lost.

### Acceptance Criteria — UX & Data
- Summary displays fabric thumbnail, name/SKU, pleating, hem, quantity/segments, selected services, and a price breakdown — all sourced from the provider.
- “Add to Cart” issues a SKU/GraphQL request to Storefront with the full configuration payload, including service SKUs.
- After adding to cart:
  - “Configure another curtain” returns to the last wizard state.
  - “Finalize purchase” opens the Storefront cart with the items preloaded; payment continues entirely in Storefront.

---

## Debug Data Mode — Plan & Structure
- **Feature flag:** `CATALOG_PROVIDER=mock|storefront` (default `mock` in development, `storefront` in production).
- **Provider interface (TypeScript):**
  ```ts
  interface CatalogProvider {
    getDefaultCurtain(): Promise<CurtainOption>;
    listFabricTypes(params: Filter): Promise<FabricType[]>;
    listFabrics(params: Filter & { fabricTypeId: string }): Promise<Fabric[]>;
    listPleats(params: Filter & { fabricId: string }): Promise<PleatOption[]>;
    listHems(params: Filter & { fabricId: string; pleatId: string }): Promise<HemOption[]>;
    listServices(params: Filter): Promise<ServiceOption[]>;
    priceQuote(config: CurtainConfig): Promise<PriceQuote>;
    toCartPayload(config: CurtainConfig): Promise<StorefrontCartItem>;
  }
  ```
- **Mock catalog schema:** lives in `/data/mock-catalog.json` and mirrors the structures above (fabric types, fabrics, pleats, hems, services, pricing rules).
- **Mock pricing function:** deterministic (e.g., `pricePerCm * widthCm * segments + modifiers + services`) so production pricing drops in without UI changes.
- **Storefront provider:** uses Magento GraphQL to fetch attributes/media/pricing, maps compatibility flags, and builds cart payloads.
- **Developer QoL:**
  - Seedable mock catalog assets.
  - Unit tests asserting the mock and storefront providers return identical shapes.
  - Storybook/Playwright scenarios run in mock mode; staging uses storefront.

---

*Last updated: synced with Stage 4–6 planning on 2025-09-16.*
