# Canvas Flicker Fix v2 - Width Effect Race Condition

## Issue
After initial fix, flickering persisted during fabric/color changes because:
1. Width effect was firing before initial render completed
2. Both main effect and width effect were running simultaneously on mount
3. This caused duplicate renders and race conditions

## Root Cause (from logs)

```
Line 1938-1945: Main effect fires with hasCache: false
                Width effect fires with hasValidCache: null (no cache yet)
                
Line 1949-1961: TWO complete renders happen:
                - First render: 708ms
                - Second render: 815ms (DUPLICATE!)
                
Line 1962+:     Width effect works correctly with valid cache during resize
```

### The Race Condition

```
Mount
  ↓
Main Effect fires → starts render (700ms)
  ↓
Width Effect fires → hasValidCache: null → does nothing BUT still runs
  ↓
Render completes → cache saved
  ↓
Width Effect fires again → hasValidCache: true → tiles
```

The problem: width effect running when there's no cache causes it to fire multiple times, and in some cases triggers the main effect again.

## The Fix

### Skip Width Effect When No Valid Cache

```typescript
useEffect(() => {
  const hasValidCache = cachedTextureRef.current && textureParamsKeyRef.current === textureParamsKey;
  
  // Skip if no valid cache - main effect will handle initial render
  if (!hasValidCache) {
    if (debug) {
      console.log('[CanvasCurtainLayer] Width effect skipped - no valid cache');
    }
    return;
  }
  
  if (debug) {
    console.log('[CanvasCurtainLayer] Width effect: tiling cached texture', {
      width,
      tileOffsetPx,
    });
  }
  
  // Fast path: tile the cached texture
  drawTexture(cachedTextureRef.current!, width, height, tileOffsetPx);
}, [width, tileOffsetPx, textureParamsKey, drawTexture, debug]);
```

### Key Changes

1. **Early return when no cache**: Width effect now skips entirely if cache isn't ready
2. **Removed height from deps**: Height changes should only trigger main effect (full render)
3. **Clearer debug logs**: Shows when tiling vs skipping

## Expected Behavior (New Logs)

```
[CanvasCurtainLayer] Main effect fired {pipeline: 'artist', pleat: 'wave', ...}
[CanvasCurtainLayer] Width effect skipped - no valid cache
[Canvas Renderer] Cache MISS - rendering...
[Artist Pipeline] Render complete {...}
[CanvasCurtainLayer] Rendered new texture {renderTimeMs: 708.2, ...}
[CanvasCurtainLayer] Width effect: tiling cached texture {width: 317, tileOffsetPx: 45}
[CanvasCurtainLayer] Width effect: tiling cached texture {width: 315, tileOffsetPx: 47}
[CanvasCurtainLayer] Width effect: tiling cached texture {width: 310, tileOffsetPx: 50}
```

## Testing Instructions

1. **Clear browser cache** and **reload page**
2. **Upload photo** and mark wall box
3. **Confirm** to go to configure page
4. **Check console** - should see:
   - Main effect fires
   - Width effect skipped (no cache)
   - Single render (700-800ms)
   - Texture appears
5. **Drag edge handle** to resize curtain:
   - Should see ONLY "Width effect: tiling cached texture" logs
   - NO "Main effect fired" during resize
   - NO "Rendering..." indicator
   - Smooth, no flicker
6. **Change fabric/color**:
   - Should see Main effect fire
   - New render
   - "Rendering..." indicator briefly
   - Smooth transition

## Files Modified

- `apps/web/app/configure/components/CanvasCurtainLayer.tsx`
  - Lines 256-276: Width effect with early return guard

## Related Fixes

This is v2 of the flicker fix. v1 (in `CANVAS-FLICKER-FIX.md`) addressed:
- Making `drawTexture` stable
- Removing width from `performRender` deps
- Separating width effect from main effect

v2 addresses:
- Race condition between effects
- Duplicate renders on mount
- Width effect firing before cache is ready
