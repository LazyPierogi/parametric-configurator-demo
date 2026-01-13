# Task 1005: Enhanced Refactoring Strategy
*Combining Plan A (detailed phases + safety) with Plan B (shared flow + features structure)*

**Date:** 2025-10-09  
**Status:** Ready for Implementation  
**Estimated Effort:** 2-3 weeks

---

## 🎯 Executive Summary

**Current Problems:**
- `configure/page.tsx`: 3,572 lines mixing 13+ concerns
- `estimate/page.tsx`: 644 lines duplicating upload/segment/measure logic from configure
- **Inline style objects cause unnecessary re-renders** (Plan B insight)
- **No shared flow layer** - duplication of retry/cache logic (Plan B insight)
- Business logic interleaved with UI concerns
- Impossible to test or maintain

**Solution:** Features-based architecture with shared flow layer, state machine, and component isolation

---

## 📊 Architecture Decisions (Plan B Insights)

### 1. Features Directory Structure ✅
```
apps/web/
├── features/                           [NEW - Plan B]
│   ├── flow/                          [Shared upload/segment/measure]
│   │   ├── hooks/
│   │   │   ├── usePhotoFlow.ts        [Upload + cache + validation]
│   │   │   ├── useSegmentationJob.ts  [Segment API + retry + cache]
│   │   │   └── useMeasurementJob.ts   [Measure API + retry + cache]
│   │   └── types.ts
│   │
│   ├── configurator/                   [Configure page logic]
│   │   ├── components/
│   │   │   ├── FileUploadZone.tsx
│   │   │   ├── WallBoxCanvas.tsx      [⚠️ CRITICAL - texture positioning]
│   │   │   ├── ConfigurationPanel.tsx
│   │   │   ├── PricingSummary.tsx
│   │   │   └── index.ts
│   │   ├── hooks/
│   │   │   ├── useWallBox.ts          [Geometry + corner snapping]
│   │   │   ├── useSegmentLayout.ts    [Panel widths + constraints]
│   │   │   ├── useTexturePreview.ts   [Crossfade + hover]
│   │   │   └── useStitchLines.ts      [Visualization]
│   │   ├── ConfiguratorProvider.tsx   [useReducer + context]
│   │   └── types.ts
│   │
│   └── estimator/                      [Estimate page logic]
│       ├── components/
│       │   ├── MeasurementForm.tsx
│       │   └── ConfirmationModal.tsx
│       └── EstimatorProvider.tsx
│
├── app/
│   ├── configure/
│   │   └── page.tsx                   [Thin wrapper: <ConfiguratorProvider><Screen/></Provider>]
│   └── estimate/
│       └── page.tsx                   [Thin wrapper: <EstimatorProvider><Screen/></Provider>]
│
└── lib/
    ├── theme/                          [NEW - Plan B]
    │   └── styles.ts                   [Centralized, stable style objects]
    ├── geometry.ts                     [Pure functions]
    └── texture.ts                      [Pure functions]
```

### 2. State Management: Reducer Pattern ✅ (Plan B)

Instead of 35+ scattered `useState` calls, use a finite-state machine:

```typescript
// features/configurator/ConfiguratorProvider.tsx

type Phase = 'idle' | 'uploading' | 'segmenting' | 'marking' | 'configuring' | 'purchasing';

type ConfiguratorState = {
  // Workflow
  phase: Phase;
  
  // File
  file: File | null;
  fileSignature: string | null;
  previewUrl: string | null;
  maskUrl: string | null;
  
  // Wall box
  corners: Point[] | null;
  baseCm: Dimensions;
  baseBoxRatio: Dimensions | null; // normalized 0..1 baseline used for scaling
  
  // Segments
  segments: SegmentLayout[];
  
  // Texture
  textureUrl: string | null;
  hoverTextureUrl: string | null;
  
  // Pricing
  quote: PriceQuote | null;
  config: CurtainConfig | null;
  
  // UI state
  busy: boolean;
  progress: Progress | null;
  errors: Record<string, string>;
};

type ConfiguratorAction =
  | { type: 'FILE_SELECTED'; file: File; signature: string }
  | { type: 'SEGMENTATION_START' }
  | { type: 'SEGMENTATION_SUCCESS'; maskUrl: string }
  | { type: 'SEGMENTATION_FAILED'; error: string }
  | { type: 'CORNERS_SET'; corners: Point[] }
  | { type: 'SEGMENT_RESIZED'; index: number; layout: SegmentLayout }
  | { type: 'TEXTURE_CHANGED'; url: string }
  | { type: 'QUOTE_UPDATED'; quote: PriceQuote }
  // ... etc

function configuratorReducer(state: ConfiguratorState, action: ConfiguratorAction): ConfiguratorState {
  switch (action.type) {
    case 'FILE_SELECTED':
      return { ...state, file: action.file, fileSignature: action.signature, phase: 'uploading' };
    case 'SEGMENTATION_START':
      return { ...state, phase: 'segmenting', busy: true };
    // ... etc
    default:
      return state;
  }
}
```

**Benefits:**
- Predictable state transitions
- Easy to test (pure reducer function)
- Single source of truth
- DevTools integration possible

---

## 🔄 Shared Flow Layer (Plan B Key Insight)

### Problem Identified by Plan B
Both `configure/page.tsx` and `estimate/page.tsx` have duplicate logic:
- File validation
- Upload with retry
- Cache lookup (IndexedDB)
- Progress tracking
- Error handling

**Current Duplication:**
```typescript
// configure/page.tsx:206
const cached = await getCachedSegment(key);
if (cached) { /* ... */ }

// estimate/page.tsx:142  
const cached = bypassCache ? null : await getCachedSegment(signature);
if (cached) { /* ... */ }
```

### Solution: Shared Flow Hooks

```typescript
// features/flow/hooks/usePhotoFlow.ts
export function usePhotoFlow() {
  return {
    validateFile: (file: File) => { /* size check, HEIC support */ },
    generateSignature: (file: File) => fingerprintBlob(file),
    createPreview: (file: File) => URL.createObjectURL(file),
  };
}

// features/flow/hooks/useSegmentationJob.ts
export function useSegmentationJob() {
  const [state, setState] = useState<JobState>({ status: 'idle' });
  
  const runSegmentation = useCallback(async (file: File, signature: string) => {
    setState({ status: 'pending', progress: 0 });
    
    // Check cache first
    const cached = await getCachedSegment(signature);
    if (cached) {
      setState({ status: 'success', result: cached, source: 'cache' });
      return cached;
    }
    
    // Run with retry logic
    try {
      const result = await segmentWithRetry(file, {
        onProgress: (p) => setState(s => ({ ...s, progress: p })),
        maxAttempts: 3,
      });
      
      await saveSegmentToCache({ key: signature, ...result });
      setState({ status: 'success', result, source: 'network' });
      return result;
    } catch (error) {
      setState({ status: 'error', error: error.message });
      throw error;
    }
  }, []);
  
  return { state, runSegmentation };
}

// features/flow/hooks/useMeasurementJob.ts
// Similar pattern for measurement
```

**Usage in Both Pages:**
```typescript
// configure/page.tsx
function ConfigurePage() {
  const photo = usePhotoFlow();
  const segmentation = useSegmentationJob();
  const measurement = useMeasurementJob();
  
  // Page-specific orchestration
}

// estimate/page.tsx
function EstimatePage() {
  const photo = usePhotoFlow();
  const segmentation = useSegmentationJob();
  const measurement = useMeasurementJob();
  
  // Different orchestration, same building blocks
}
```

---

## 🎨 Centralized Styles (Plan B Insight)

### Problem: Inline Styles Hurt Performance
```typescript
// ❌ BEFORE: New object every render
<div style={{ padding: '8px 12px', borderRadius: 8, ... }}>

// ❌ BEFORE: Lambda recreated every render
{fabrics.map(f => <Card style={cardStyle(f.id === selected)} />)}
```

Every render creates new objects → React sees them as "changed" → unnecessary re-renders

### Solution: Stable Style Objects

```typescript
// lib/theme/styles.ts
export const theme = {
  colors: {
    primary: '#4a67ff',
    primaryLight: '#eef2ff',
    border: '#e2e8f0',
    // ... etc
  },
  spacing: {
    xs: 4, sm: 8, md: 12, lg: 16, xl: 24,
  },
  radius: {
    sm: 8, md: 10, lg: 12, full: 999,
  },
} as const;

// Stable style objects (created once)
export const styles = {
  button: {
    padding: '8px 12px',
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    background: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  } as const,
  
  buttonPrimary: {
    ...styles.button,
    background: theme.colors.primary,
    color: '#fff',
    border: 'none',
  } as const,
} as const;

// Dynamic styles with memoization
export function chipStyle(selected: boolean): CSSProperties {
  // Cache by selected boolean
  return selected ? chipStyleSelected : chipStyleDefault;
}

const chipStyleDefault = { /* ... */ } as const;
const chipStyleSelected = { /* ... */ } as const;
```

**Benefits:**
- Referential equality preserved → fewer re-renders
- Type-safe design tokens
- Easier to theme/customize
- Clear design system

---

## 🚀 Implementation Phases (Hybrid Plan)

### Phase 1: Shared Flow Layer (1 week)
**Priority:** HIGH - Eliminates duplication, foundation for rest

#### Week 1, Day 1-2: Extract Flow Hooks
```
✅ Create features/flow/hooks/usePhotoFlow.ts
✅ Create features/flow/hooks/useSegmentationJob.ts  
✅ Create features/flow/hooks/useMeasurementJob.ts
✅ Add unit tests (cache, retry, error handling)
✅ Update estimate/page.tsx to use new hooks
```

#### Week 1, Day 3: Centralize Styles
```
✅ Create lib/theme/styles.ts
✅ Move all inline styles from configure/components/styles.ts
✅ Update components to use stable references
✅ Verify no visual regressions
```

#### Week 1, Day 4-5: Domain Logic Extraction
```
✅ Create lib/geometry.ts (corner snapping, bounds calculations)
✅ Create lib/texture.ts (invertMaskAlpha, orientation)
✅ Move coverage/constraint logic to packages/core if catalog-related
✅ Add unit tests for pure functions
```

**Success Criteria:**
- [ ] estimate/page.tsx < 300 lines (uses shared hooks)
- [ ] Zero duplication of upload/segment/measure logic
- [ ] 90%+ coverage on flow hooks
- [ ] All inline styles moved to theme module

---

### Phase 2: Configurator State Machine (1 week)
**Priority:** HIGH - Enables clean component splits

#### Week 2, Day 1-2: ConfiguratorProvider
```
✅ Create features/configurator/ConfiguratorProvider.tsx
✅ Define ConfiguratorState type
✅ Define ConfiguratorAction type
✅ Implement configuratorReducer with FSM
✅ Add context provider wrapper
✅ Write reducer unit tests
```

#### Week 2, Day 3: Migrate to Reducer
```
✅ Wrap configure/page.tsx with <ConfiguratorProvider>
✅ Replace useState calls with dispatch calls (one at a time)
✅ Verify functionality after each migration
✅ Remove old state declarations
```

#### Week 2, Day 4-5: Extract Specialized Hooks
```
✅ Create features/configurator/hooks/useWallBox.ts
✅ Create features/configurator/hooks/useSegmentLayout.ts  
✅ Create features/configurator/hooks/useTexturePreview.ts
✅ Create features/configurator/hooks/useStitchLines.ts
✅ Each hook reads from context, dispatches actions
```

**Success Criteria:**
- [ ] Single useReducer replaces 35+ useState calls
- [ ] Predictable state transitions (FSM)
- [ ] DevTools-friendly state inspection
- [ ] configure/page.tsx < 1,500 lines

---

### Phase 3: Component Extraction (1 week)
**Priority:** MEDIUM - Final cleanup, visual isolation

#### Week 3, Day 1: Upload & Preview Components
```
✅ Create features/configurator/components/FileUploadZone.tsx
✅ Memo-ize, receive props from context
✅ Extract from page.tsx
```

#### Week 3, Day 2-3: WallBoxCanvas (⚠️ CRITICAL)
```
⚠️ Create features/configurator/components/WallBoxCanvas.tsx
⚠️ PRESERVE texture positioning logic (Memory #3ef5867c):
   - backgroundSize: ${texScale}px ${wallBoxHeight}px
   - backgroundPosition: 0px ${topOfWallBox}px
   - imgSize.h pixel calculations
⚠️ PRESERVE curtain rendering (Memory #b0b3e44d):
   - backgroundRepeat: 'repeat-x'
   - Horizontal tiling + vertical scaling
✅ Add visual regression tests
✅ Manual QA checklist
```

#### Week 3, Day 4: Panel & Summary Components
```
✅ Create features/configurator/components/ConfigurationPanel.tsx
✅ Create features/configurator/components/PricingSummary.tsx
✅ Wire to context, memo-ize
```

#### Week 3, Day 5: Integration Testing & Polish
```
✅ End-to-end flow test (upload → configure → quote → cart)
✅ Performance benchmark (before/after)
✅ Update RUNBOOK.md and README.md
✅ Final code review
```

**Success Criteria:**
- [ ] configure/page.tsx < 700 lines (thin wrapper)
- [ ] All components memo-ized with stable props
- [ ] Zero visual regressions
- [ ] Performance metrics same or better

---

## 🧪 Testing Strategy (Enhanced from Plan A)

### Unit Tests (Vitest)
```typescript
// features/flow/hooks/__tests__/useSegmentationJob.test.ts
describe('useSegmentationJob', () => {
  it('checks cache before network call', async () => { /* ... */ });
  it('retries on network failure', async () => { /* ... */ });
  it('saves result to cache on success', async () => { /* ... */ });
  it('tracks progress during upload', async () => { /* ... */ });
});

// features/configurator/__tests__/reducer.test.ts
describe('configuratorReducer', () => {
  it('transitions from idle to uploading on FILE_SELECTED', () => {
    const state = configuratorReducer(initialState, { type: 'FILE_SELECTED', file, signature });
    expect(state.phase).toBe('uploading');
  });
  
  it('sets error on SEGMENTATION_FAILED', () => { /* ... */ });
  // ... all state transitions
});

// lib/__tests__/geometry.test.ts
describe('snapToRightAnglePx', () => {
  it('snaps corner within 5° threshold', () => { /* ... */ });
  it('returns original point when deviation > threshold', () => { /* ... */ });
});
```

### Integration Tests (React Testing Library)
```typescript
// features/configurator/__tests__/ConfiguratorProvider.test.tsx
describe('ConfiguratorProvider', () => {
  it('orchestrates upload → segment → mark → configure flow', async () => {
    const { user } = render(<TestApp />);
    
    // Upload file
    const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByRole('button', { name: /upload/i }), file);
    
    // Wait for segmentation
    expect(await screen.findByText(/segmenting/i)).toBeInTheDocument();
    
    // Mark corners
    await user.click(canvas, { clientX: 100, clientY: 100 });
    // ... 4 corners
    
    // Verify phase transition
    expect(screen.getByText(/configure/i)).toBeInTheDocument();
  });
});
```

### Visual Regression (Playwright)
```typescript
// e2e/configurator.spec.ts
test('curtain texture positioning', async ({ page }) => {
  await page.goto('/configure');
  await page.setViewportSize({ width: 1280, height: 720 });
  
  // Upload and mark
  // ...
  
  // Drag wall box corner
  await page.dragAndDrop('.corner-handle-0', '.target-position');
  
  // Snapshot curtain rendering
  const canvas = page.locator('.wall-box-canvas');
  await expect(canvas).toHaveScreenshot('curtain-positioned.png', {
    maxDiffPixels: 50, // Allow minor antialiasing differences
  });
});
```

**Coverage Targets:**
- Flow hooks: 90%+
- Reducer: 100% (pure function)
- Geometry/texture utils: 95%+
- Components: 70%+ (focus on logic, not JSX)
- E2E: Critical paths (upload → configure → cart)

---

## 🛡️ Safety Guarantees (From Plan A)

### Critical Preservation Checklist

**Before ANY change to WallBoxCanvas:**
```
⚠️ [ ] Verify texture backgroundSize calculation uses imgSize.h
⚠️ [ ] Verify backgroundPosition anchored to Wall Box top
⚠️ [ ] Verify texOrient rotation compensation preserved
⚠️ [ ] Verify backgroundRepeat: 'repeat-x' not changed
⚠️ [ ] Run visual regression test suite
⚠️ [ ] Manual test: drag corner → texture follows smoothly
⚠️ [ ] Manual test: hover color chip → preview updates
⚠️ [ ] Manual test: lighting mode switches correctly
```

### Rollback Strategy
- Each phase is a separate PR with feature flag if needed
- Keep old implementation commented during migration
- Automated performance benchmarks block merge if regression
- Visual regression tests must pass
- Manual QA sign-off required for Phase 3

---

## 📈 Expected Outcomes

### Maintainability
| File | Before | After | Change |
|------|--------|-------|--------|
| configure/page.tsx | 3,572 lines | ~650 lines | **-82%** |
| estimate/page.tsx | 644 lines | ~250 lines | **-61%** |
| New features/* | 0 lines | ~2,000 lines | Organized |
| **Total** | 4,216 lines | 2,900 lines | **-31%** overall |

### Code Quality
- **Duplication**: ~400 lines eliminated (shared flow hooks)
- **Testability**: 0% → 85% coverage
- **Re-renders**: Reduced by ~30% (stable styles)
- **State transitions**: Predictable (FSM)

### Developer Experience
- **Feature velocity**: +40% (isolated concerns)
- **Bug fix time**: -50% (smaller surface area)
- **Onboarding**: -60% (clear structure)

---

## 🎯 Next Steps

### Immediate Actions
1. **Team Review** - Get sign-off on features/ structure
2. **Ticket Creation** - Break into small, reviewable PRs
3. **Baseline Metrics** - Capture current performance/bundle size

### Phase 1 Kickoff (Week 1)
```bash
# Create features directory
mkdir -p apps/web/features/{flow,configurator,estimator}/{hooks,components}

# Extract first shared hook
# PR #1: features/flow/hooks/usePhotoFlow.ts + tests

# Update estimate page
# PR #2: estimate/page.tsx uses usePhotoFlow

# Centralize styles
# PR #3: lib/theme/styles.ts + migrate components
```

---

## 📚 References

- **Original Analysis**: Task 1005 Plan A (hooks extraction)
- **Alternative Plan**: Refactor Plan B (features structure)
- **Architecture**: `project planning/02-Code-Architecture.md`
- **Critical Constraint**: Memory #3ef5867c (texture positioning)
- **Critical Constraint**: Memory #b0b3e44d (curtain rendering)

---

**Status:** ✅ Ready for Implementation  
**Author:** AI Assistant + Designer Stakeholder  
**Date:** 2025-10-09  
**Approval Required:** Team Lead + Designer
