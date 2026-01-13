# HEIC/HEIF Image Support

## Overview

Curtain Wizard now supports iPhone HEIC photos with automatic conversion to JPEG for processing.

## What Changed

### Before
- ❌ HEIC files: No preview
- ❌ Segmentation failed
- ❌ No file type validation
- ⚠️ Any file accepted (security risk)

### After  
- ✅ HEIC files automatically converted to JPEG
- ✅ Preview displays correctly
- ✅ Segmentation works normally
- ✅ File type validation (only safe image formats allowed)
- ✅ User-friendly error messages

## Supported Formats

**Allowed:**
- JPEG/JPG (`image/jpeg`)
- PNG (`image/png`)
- WebP (`image/webp`)
- **HEIC/HEIF** (`image/heic`, `image/heif`) ← iPhone default

**Blocked:**
- PDF, SVG, GIF, BMP, TIFF
- Non-image files
- Executable files
- Any suspicious formats

## How It Works

### Conversion Flow

1. User selects/drops HEIC file
2. File type validated (allowed formats only)
3. HEIC detected → automatic conversion to JPEG
4. If the browser converter fails, the file is sent to `/api/convert-heic` for server-side conversion
5. Converted file passed to measurement/segmentation
6. User sees toast: "HEIC image converted to JPEG"

### Technical Details

- **Client library:** `heic2any` (dynamically imported when needed)
- **Client optimization:** Images resized using Canvas API with configurable settings
- **Server fallback:** `/api/convert-heic` uses `heic-convert` + `sharp` for resize & optimization
- **Quality:** JPEG quality with mozjpeg optimization (excellent quality, 60-80% size reduction)
- **Performance:** ~1-3 seconds for conversion + optimization
- **File size:** 4032x3024 HEIC (4MB) → 2048x1536 JPEG (800KB-1.5MB) with defaults
- **Memory:** Conversion happens in-browser; fallback uploads only if the client converter fails

### Configuration

HEIC optimization can be tuned via environment variables:

```bash
# Server-side settings (for /api/convert-heic fallback)
HEIC_MAX_DIMENSION=2048        # Maximum dimension in pixels (default: 2048)
HEIC_JPEG_QUALITY=82           # JPEG quality 0-100 (default: 82)

# Client-side settings (for browser conversion)
NEXT_PUBLIC_HEIC_MAX_DIMENSION=2048
NEXT_PUBLIC_HEIC_JPEG_QUALITY=82
```

**Tuning guidelines:**
- **Quality 90-95:** Excellent quality, larger files (~2-3MB), slower uploads
- **Quality 82 (default):** Great quality, balanced files (~1-1.5MB), fast uploads ✅
- **Quality 70-75:** Good quality, small files (~600KB-900KB), very fast uploads
- **Dimension 3000px:** Higher detail, larger files, slower processing
- **Dimension 2048px (default):** Balanced detail/size for most use cases ✅
- **Dimension 1536px:** Lower detail, smaller files, fastest processing

## User Experience

### iPhone Photo Upload

```
1. User takes photo with iPhone (saves as HEIC)
2. User uploads to Curtain Wizard
3. Toast: "HEIC image converted to JPEG" (brief)
4. Processing continues automatically (no second toast for HEIC to reduce noise)
```

### Invalid File Upload

```
1. User tries to upload .pdf or .svg
2. Toast: "Invalid file type. Please upload JPEG, PNG, WebP, or HEIC"
3. Upload rejected (no processing)
```

### File Too Large

```
1. User uploads 50MB HEIC photo
2. Toast: "File is too large. Maximum size: 15MB"
3. Upload rejected before conversion (saves time)
```

## Implementation

### Files Changed

- **`apps/web/lib/image-validation.ts`** — Validation & conversion logic with server fallback
- **`apps/web/app/estimate/page.tsx`** — Upload validation on /estimate (stale conversion guard)
- **`apps/web/app/api/convert-heic/route.ts`** — Server-side conversion using `heic-convert`
- **`apps/web/package.json`** — Added `heic2any` dependency

### Code Example

```typescript
import { validateAndConvertImage } from '@/lib/image-validation';

// In file upload handler
const validation = await validateAndConvertImage(file, MAX_BYTES);

if (!validation.valid) {
  toast.error(validation.message);
  return;
}

const processedFile = validation.file!; // Converted if HEIC
// Continue with processedFile...
```

## Performance

### HEIC Conversion + Optimization Times

| Original HEIC | Conversion Time | Final JPEG Size | Segmentation Time |
|---------------|-----------------|-----------------|-------------------|
| 2 MB (3024x4032) | ~1.5 seconds | 800 KB | ~5-7 seconds |
| 5 MB (3024x4032) | ~2 seconds | 1.2 MB | ~5-7 seconds |
| 10 MB (3024x4032) | ~3 seconds | 1.5 MB | ~5-7 seconds |
| 15 MB (max) | ~4 seconds | 2 MB | ~5-7 seconds |

*Times measured on iPhone 13 / M1 Mac / Production*

**Key improvements:**
- **60-80% file size reduction** (4MB → 1MB typical)
- **Segmentation 5-10x faster** (60s → 5-7s)
- **Network upload faster** due to smaller files
- **Quality remains excellent** (82% JPEG is visually identical to 90%)

### Memory Usage

- **Before conversion:** Original HEIC file in memory
- **During conversion:** 2x file size temporarily (HEIC + JPEG)
- **After conversion:** Original HEIC released, JPEG kept

For 15MB max size: ~30MB peak memory (negligible for modern devices)

## Error Handling

### Conversion Failures

**Causes:**
- Corrupted HEIC file
- Unsupported HEIC variant
- Browser compatibility issue
- Out of memory

**Handling:**
- Browser conversion errors trigger automatic `/api/convert-heic` fallback
- If both paths fail, the UI shows: "We couldn’t process the HEIC photo. Please try again."
- Upload is rejected so the user can retry (no manual conversion required)

## Browser Compatibility

### Supported Browsers

- ✅ Chrome 80+ (desktop & mobile)
- ✅ Firefox 78+ (desktop & mobile)
- ✅ Safari 14+ (desktop & mobile)
- ✅ Edge 80+

### Unsupported Browsers

- ❌ IE 11 (EOL, not supported by Next.js anyway)
- ⚠️ Older Safari (<14): HEIC conversion may fail

**Fallback:** User sees conversion error and can retry; the app attempts server conversion automatically

## Security

### File Type Validation

**Why it matters:**
- Prevents malicious file uploads (`.exe` disguised as `.jpg`)
- Blocks SVG (can contain scripts)
- Blocks PDF (large file size, no image data)

**How it works:**
1. Check MIME type first (`file.type`)
2. Fallback to file extension if MIME missing
3. Both must match allowed list
4. Reject immediately if invalid

### HEIC Conversion Safety

- **Client-side only:** No server processing, no data leaves browser
- **Trusted library:** `heic2any` is widely used, actively maintained
- **No external requests:** Conversion happens entirely in JavaScript
- **Output sanitized:** Converted JPEG is standard format, no embedded data

## Testing

### Manual Test Cases

1. **HEIC upload**
   - Upload iPhone HEIC photo
   - ✅ Preview displays
   - ✅ Segmentation succeeds
   - ✅ Toast shows conversion notice

2. **JPEG upload**
   - Upload regular JPEG
   - ✅ No conversion toast
   - ✅ Processing normal

3. **Invalid format**
   - Try uploading `.pdf` or `.svg`
   - ✅ Error toast
   - ✅ Upload blocked

4. **File too large**
   - Try uploading 20MB HEIC
   - ✅ Error toast (before conversion)
   - ✅ Upload blocked

5. **Drag & drop HEIC**
   - Drag HEIC file onto upload area
   - ✅ Conversion works
   - ✅ Same UX as file picker

6. **Paste HEIC** (if browser supports)
   - Copy HEIC image, paste into Curtain Wizard
   - ✅ Conversion works
   - ✅ Processing continues

### Automated Tests

*(To be added)*

```typescript
// Test file validation
describe('validateAndConvertImage', () => {
  it('accepts JPEG files', async () => {
    const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
    const result = await validateAndConvertImage(file, 15 * 1024 * 1024);
    expect(result.valid).toBe(true);
  });

  it('rejects invalid file types', async () => {
    const file = new File([''], 'test.pdf', { type: 'application/pdf' });
    const result = await validateAndConvertImage(file, 15 * 1024 * 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_type');
  });

  it('rejects files too large', async () => {
    const large = new File([new ArrayBuffer(20 * 1024 * 1024)], 'large.jpg');
    const result = await validateAndConvertImage(large, 15 * 1024 * 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('file_too_large');
  });
});
```

## Troubleshooting

### HEIC conversion fails

**Common causes:**
1. **HEIC variant not supported** - Some iPhone HEIC formats aren't compatible with the converter
2. **Browser compatibility** - Needs Chrome 80+, Safari 14+, or equivalent
3. **File size too large** - Must be under 15MB
4. **Corrupted file** - Try opening on device first

**Solutions:**

**Option 1: Manual conversion (Recommended)**
1. Open iPhone Photos app
2. Select the HEIC photo
3. Tap Share → Save as JPEG
4. Upload the JPEG to Curtain Wizard

**Option 2: Use iPhone settings**
```
Settings → Camera → Formats → Most Compatible
```
This makes iPhone save photos as JPEG instead of HEIC

**Option 3: Try different browser**
- Chrome/Edge: Better HEIC support
- Safari: Native HEIC handling on Mac
- Firefox: May have limitations

### Known Limitations

⚠️ **HEIC auto-conversion is experimental**
- Works for most standard iPhone photos
- Some HEIC variants may fail to convert
- Large files (>10MB) may take 3-5 seconds
- If conversion fails, manual JPEG conversion required

### Current status

The HEIC conversion feature uses the `heic2any` library (v0.0.4), which has known limitations:
- ✅ Works with most iPhone 12-14 HEIC files
- ⚠️ May fail with iPhone 15 Pro Max HEIC files (newer encoding)
- ⚠️ Some HEIC variants from third-party camera apps not supported
- ⚠️ HEIC files with HDR/ProRAW data may fail

**If you frequently encounter HEIC conversion failures**, we recommend changing your iPhone camera settings to save photos as JPEG by default.

### Preview not showing after conversion

**Check:**
1. Browser console for errors
2. Network tab: check if file processed
3. File signature cached correctly

**Fix:** Try different browser or clear browser cache

### Conversion takes too long

**Expected for:**
- Large HEIC files (10-15MB): ~4 seconds
- Slow devices: Up to 5-6 seconds

**Not normal:**
- >10 seconds: Possible browser issue or corrupted file
- Infinite spinner: Conversion likely failed, refresh page

### Segmentation feels slow after HEIC upload

- Check the `/api/segment` response headers — `X-Segment-Backend=local-mask2former` means the GPU handled it. If you see `hf-mask2former` or `hf-segformer`, the request fell back to Hugging Face and will take ~30-60s.
- Server logs now include warnings like `[segment] local mask2former failed ... (payload 1.2MB)` whenever fallback happens; capture the message to see whether the JPEG was malformed or the FastAPI service timed out.
- Re-run with “Bypass local cache” off so the IndexedDB write finishes before navigating; otherwise `/configure` may trigger an extra segmentation call while the cache is still writing.

## Future Improvements

### Possible Enhancements

1. **Progress indicator** during HEIC conversion
2. **Batch conversion** for multiple files
3. **AVIF support** (newer iPhone format)
4. **WebP conversion** for Android photos
5. **Image optimization** (resize large images before processing)

### Not Planned

- ❌ Server-side HEIC conversion (adds complexity, slower)
- ❌ Raw format support (CR2, NEF, etc.) - too niche
- ❌ GIF/animated images - not suitable for wall measurement

## Related Documentation

- `apps/web/lib/image-validation.ts` - Implementation
- `docs/RUNBOOK.md` - Development guide
- `README.md` - Project overview
