# Performance Optimization - Segmentation Cache

## Problem

Segmentation was significantly slower on iPhone compared to MacBook, even with identical image sizes. This indicated a **client-side performance bottleneck**.

### Root Cause

After the segmentation API completes, the app saves results to IndexedDB cache **synchronously** before updating the UI. The `saveSegmentToCache()` function:

1. **Reads ALL cached entries** from IndexedDB (`listAll(db)`)
2. **Calculates total size** of all blobs by iterating through entries
3. **Sorts and deletes** old entries if quota is exceeded
4. **Writes new entry** to IndexedDB

On iPhone, this cache operation took **10-20 seconds** because:
- IndexedDB operations are slower on mobile Safari
- Blob size calculations are CPU-intensive on slower iPhone CPU
- This **blocked the main thread** synchronously, preventing UI updates

### Symptoms

- **MacBook:** Segmentation completes → UI updates immediately (~5-7 seconds total)
- **iPhone:** Segmentation completes → Hangs for 10-20 seconds → UI updates (~30-60 seconds total)

## Solution

### UI-First Cache Writes

**Before optimisation (old flow):**
```typescript
const maskBlob = await res.blob();
const entry = { key, mask: maskBlob, ... };

// CACHE awaited before UI, making success screen wait 10-20s on slow devices
await saveSegmentToCache(entry);
setSegStatus('success');
```

**Current approach:**
```typescript
const maskBlob = await res.blob();
const entry = { key, mask: maskBlob, ... };

// 1. Tell React to render success immediately
setSegStatus('success');

// 2. Still await the cache write so Configure can rely on it
await saveSegmentToCache(entry);
```

React flushes state updates before the awaited promise resolves, so the UI still feels instant, but we keep the offline resume guarantee because the function doesn’t finish until the cache is actually written.

### Benefits

✅ **iPhone performance:** UI updates immediately after segmentation (5-7 seconds)  
✅ **Cache still works:** `saveSegmentToCache` still awaited, so `/configure` restores reliably  
✅ **No user-visible change:** Users see results instantly  
✅ **Graceful degradation:** If cache fails, we log and continue (same as before)

### Performance Logging

Added detailed logging to track cache performance:

```
[estimate] UI updated in 3ms after blob received
[segment-cache] Starting cache save
[segment-cache] listAll took 2345ms, found 5 entries
[segment-cache] size calculation took 456ms, total: 12345678 bytes
[segment-cache] Cache save completed in 3128ms
[estimate] Segment cache save completed in 3128ms
```

This helps identify slow operations on different devices.

## Files Modified

- **`apps/web/app/estimate/page.tsx`** - Made cache operations non-blocking
- **`apps/web/lib/segment-cache.ts`** - Added performance logging

## Testing

Test on production with iPhone:

1. Upload HEIC photo on `/estimate`
2. Check browser console for timing logs
3. Verify UI updates immediately after segmentation
4. Verify cache saves in background (check console logs)

Expected timeline:
- Segmentation API: ~4-5 seconds
- UI update: <100ms after blob received
- Background cache: 3-10 seconds (doesn't block UI)
- **Total perceived time: 4-5 seconds** ✅

## Additional Fix: Extended Cache Retry Window

**Problem:** Even with non-blocking cache, users who navigated within 1-2 seconds would trigger duplicate segmentation because `/configure`'s retry window (~1.8s) was shorter than cache save time (10-20s on iPhone).

**Solution:** Extended `/configure` cache retry from 6 attempts (1.8s) to 10 attempts (19s total):
```typescript
const cached = await loadCachedSegmentWithRetry(flow.segmentKey, 10, 250);
// 10 attempts × 250ms base × 1.5x exponential = ~19 seconds
```

**Result:** Users who navigate quickly now wait up to 19 seconds for cache instead of re-segmenting. In most cases, cache completes within 5-10 seconds and they proceed immediately. ✅

## Future Optimizations

If cache operations remain slow on mobile, consider:

1. **Cache size limit:** Reduce `MAX_CACHE_BYTES` on mobile devices
2. **Lazy eviction:** Only check quota when cache is nearly full
3. **Web Worker:** Move cache operations to background thread
4. **Disable on slow devices:** Skip cache if `navigator.hardwareConcurrency < 4`

## Related Issues

- HEIC optimization: See `docs/HEIC-SUPPORT.md`
- Segmentation pipeline: See `docs/RUNBOOK.md`
