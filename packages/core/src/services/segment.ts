import { loadEnv } from '@curtain-wizard/shared/src/env';
import type { SegmentResult } from '../types/services';

// We reuse the proven pipeline from curtain-visualizer for now.
// It composes RAW masks from local Mask2Former and applies Node-side post-process.
// Later we can move the file into packages/core.

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0B';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
};

const describeError = (err: unknown): string => {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

export async function segmentToPngAlpha(input: Buffer, debugDir?: string): Promise<SegmentResult> {
  loadEnv();
  // Import segmentation pipeline from core lib
  const { generateWallAlphaMaskPNG } = await import('../lib/segmentation');
  const payloadSize = formatBytes(input?.length ?? 0);
  const originalBytes = input?.length ?? 0;
  let effectiveInputBytes = originalBytes;
  type FallbackInputSummary = { bytes: number; width: number; height: number; quality: number };
  let fallbackDetails: FallbackInputSummary | null = null;
  const onFallbackInput = (info: FallbackInputSummary) => {
    effectiveInputBytes = info.bytes;
    fallbackDetails = info;
  };

  const localStart = Date.now();
  try {
    // Primary: local Mask2Former (compose-from-raw handled by env)
    const png = await generateWallAlphaMaskPNG(input, {
      model: 'local:mask2former:ade20k',
      ...(debugDir ? { debugDir } : {}),
      threshold: undefined,
      onFallbackInput,
    });
    return { png, backend: 'local-mask2former', inputBytes: originalBytes };
  } catch (e) {
    const elapsed = Date.now() - localStart;
    console.warn(`[segment] local mask2former failed in ${elapsed}ms (payload ${payloadSize}): ${describeError(e)}`);

    // Fallback 1: HF Mask2Former
    const hfMaskStart = Date.now();
    try {
      effectiveInputBytes = originalBytes;
      fallbackDetails = null;
      const png = await generateWallAlphaMaskPNG(input, {
        model: 'facebook/mask2former-swin-large-ade-semantic',
        ...(debugDir ? { debugDir } : {}),
        onFallbackInput,
      });
      if (fallbackDetails) {
        const { width, height, bytes, quality } = fallbackDetails;
        console.info(
          `[segment] hf-mask2former fallback input resized to ${width}x${height} (${formatBytes(bytes)}) quality=${quality}`
        );
      }
      console.info(`[segment] used hf-mask2former fallback in ${Date.now() - hfMaskStart}ms (payload ${payloadSize})`);
      return { png, backend: 'hf-mask2former', inputBytes: effectiveInputBytes };
    } catch (hfErr) {
      const elapsedHf = Date.now() - hfMaskStart;
      console.warn(`[segment] hf-mask2former fallback failed in ${elapsedHf}ms (payload ${payloadSize}): ${describeError(hfErr)}`);

      // Fallback 2: HF SegFormer
      const hfSegStart = Date.now();
      try {
        effectiveInputBytes = originalBytes;
        fallbackDetails = null;
        const png = await generateWallAlphaMaskPNG(input, {
          model: 'nvidia/segformer-b5-finetuned-ade-640-640',
          ...(debugDir ? { debugDir } : {}),
          onFallbackInput,
        });
        if (fallbackDetails) {
          const { width, height, bytes, quality } = fallbackDetails;
          console.info(
            `[segment] hf-segformer fallback input resized to ${width}x${height} (${formatBytes(bytes)}) quality=${quality}`
          );
        }
        console.info(`[segment] used hf-segformer fallback in ${Date.now() - hfSegStart}ms (payload ${payloadSize})`);
        return { png, backend: 'hf-segformer', inputBytes: effectiveInputBytes };
      } catch (segErr) {
        const elapsedSeg = Date.now() - hfSegStart;
        console.error(`[segment] hf-segformer fallback failed in ${elapsedSeg}ms (payload ${payloadSize}): ${describeError(segErr)}`);
        throw segErr;
      }
    }
  }
}
