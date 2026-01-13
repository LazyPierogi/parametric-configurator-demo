# Cache System Fix - October 2024

## Issues Fixed

### Issue 1: Flow State Consumed Prematurely
**Problem:** Flow state was deleted immediately on first `/configure` load, making it unavailable for back navigation or page refreshes.

**Root Cause:** `consumeFlowState()` called `sessionStorage.removeItem()` immediately, removing the state before confirming successful cache load.

**Solution:** Split into two functions:
- `peekFlowState()`: Read without deleting
- `clearFlowState()`: Explicit deletion only after successful load

### Issue 2: Missing Fallback Chain When CONFIGURE_FALLBACK_LATEST=0
**Problem:** When `NEXT_PUBLIC_CONFIGURE_FALLBACK_LATEST=0` and flow state was missing, `/configure` stayed idle even when coming from `/estimate` with valid cache.

**Root Cause:** No fallback to `lastUploadedKey` when the env flag was disabled.

**Solution:** Implemented 3-level fallback chain (independent of env flag for levels 1-2):
1. **Flow state** (from `/estimate` navigation) - Primary path
2. **lastUploadedKey** (session continuity) - Always available
3. **Latest cached segment** (only if `CONFIGURE_FALLBACK_LATEST=1`) - True fallback

### Issue 3: Race Condition with Photo Switching
**Problem:** When uploading multiple photos quickly, sometimes an older cached photo appeared instead of the freshly uploaded one.

**Root Cause:** `lastUploadedKey` not synchronized with actual cache writes, leading to stale key references.

**Solution:** Update `lastUploadedKey` immediately after every cache write:
- After new segmentation completes
- After cached segment is refreshed
- Even on cached hits (to maintain consistency)

## Implementation Details

### File: `apps/web/lib/flow-state.ts`
```typescript
// New non-destructive read
export function peekFlowState(): FlowState | null

// Explicit clear (only called after successful load)
export function clearFlowState(): void

// Existing function now uses peek + clear
export function consumeFlowState(): FlowState | null
```

### File: `apps/web/app/configure/page.tsx`
```typescript
// Multi-level fallback in restore effect:

// Level 1: Flow state (peek, don't consume immediately)
const flow = peekFlowState();
if (flow) {
  const cached = await loadCachedSegmentWithRetry(flow.segmentKey);
  if (cached) {
    await applySegment(cached);
    clearFlowState(); // Only clear on success
    return;
  }
  clearFlowState(); // Clear stale state
}

// Level 2: lastUploadedKey (session continuity)
const lastKey = getLastUploadedKey();
if (lastKey) {
  const cached = await getCachedSegment(lastKey);
  if (cached) {
    await applySegment(cached);
    return;
  }
}

// Level 3: Latest cached (only if env flag enabled)
if (CONFIGURE_FALLBACK_LATEST) {
  const latest = await getLatestCachedSegment();
  if (latest) {
    await applySegment(latest);
    return;
  }
}

// No cache: stay idle
```

### File: `apps/web/app/estimate/page.tsx`
```typescript
// After new segmentation:
await saveSegmentToCache(entry);
setLastUploadedKey(signature); // ← Sync immediately

// After cached hit:
if (cached) {
  setLastUploadedKey(signature); // ← Keep consistent

  // Even when refreshing cache:
  if (needsRefresh) {
    await saveSegmentToCache(refreshed);
    setLastUploadedKey(signature); // ← Update again
  }
}
```

## Behavior Changes

### Before
- ❌ Flow state deleted immediately, lost on refresh
- ❌ `CONFIGURE_FALLBACK_LATEST=0` broke cache flow from `/estimate`
- ❌ Rapid photo switches sometimes loaded wrong photo
- ⚠️ `CONFIGURE_FALLBACK_LATEST` was required for cache to work

### After
- ✅ Flow state preserved until successful load (legacy flow mode)
- ✅ Cache works regardless of `CONFIGURE_FALLBACK_LATEST` setting
- ✅ Correct photo always loads (synchronized key tracking)

 

**Note (curtain-first flow):** In the curtain-first mode, `/configure` still uses the same 3-level restore chain on initial mount (FlowState → `lastUploadedKey` → latest cached segment when enabled) so that reloads, back/forward navigation, and direct URL revisits can reopen the last valid session. Only when **none** of these restore paths succeed (no FlowState and no usable cache) does the page redirect to `/estimate` to start a fresh measurement flow.

## Testing Checklist

### Scenario 1: Normal Flow (CONFIGURE_FALLBACK_LATEST=0)
1. Upload photo on `/estimate`
2. Confirm dimensions
3. Navigate to `/configure`
4. **Expected:** Photo loads correctly ✅

### Scenario 2: Back Navigation
1. Complete Scenario 1
2. Navigate back to `/estimate`
3. Upload same or different photo
4. Navigate to `/configure`
5. **Expected:** New photo loads (not old one) ✅

### Scenario 3: Page Refresh
1. Upload photo on `/estimate`, navigate to `/configure`
2. Refresh `/configure` page
3. **Expected:** Photo persists (via `lastUploadedKey` fallback) ✅

### Scenario 4: Rapid Photo Switching
1. Upload photo A → wait for cache
2. Upload photo B → immediately confirm
3. Navigate to `/configure`
4. **Expected:** Photo B loads (not A) ✅

### Scenario 5: Direct Configure Access
1. Set `NEXT_PUBLIC_CONFIGURE_FALLBACK_LATEST=1`
2. Navigate directly to `/configure` (no prior `/estimate` visit)
3. **Expected:** Latest cached photo loads ✅

### Scenario 6: Direct Configure Access (Fallback Disabled)
1. Set `NEXT_PUBLIC_CONFIGURE_FALLBACK_LATEST=0`
2. Navigate directly to `/configure`
3. **Expected:** Stays idle, prompts for upload ✅

## Environment Variables

### `NEXT_PUBLIC_CONFIGURE_FALLBACK_LATEST`
- **Default:** `0` (disabled)
- **Purpose:** Enable automatic restore of latest cached segment when accessing `/configure` directly (without coming from `/estimate`)
- **Values:**
  - `0`: No fallback to latest cache (recommended for production)
  - `1`: Auto-restore latest cached segment (useful for development/testing)

**Note:** This flag does NOT affect the normal flow from `/estimate` → `/configure`, which always works regardless of this setting.

## Migration Notes

### For Developers
- Replace any direct `consumeFlowState()` calls with `peekFlowState()` + `clearFlowState()` if you need more control
- The old `consumeFlowState()` still works (now calls peek + clear internally)

### For Users
- No action required
- Cache behavior is now more predictable and robust
- Back/refresh navigation will work better

## Related Files
- `apps/web/lib/flow-state.ts` - Flow state management
- `apps/web/lib/segment-cache.ts` - IndexedDB cache operations
- `apps/web/app/estimate/page.tsx` - Photo upload & cache writes
- `apps/web/app/configure/page.tsx` - Cache restoration logic
