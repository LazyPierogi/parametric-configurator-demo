"use client";

import { useCallback } from 'react';

export function useCurtainFirstTexturePreviewDisabled(): {
  ensureImage: (url?: string | null) => Promise<boolean>;
  getRenderableUrl: (url?: string | null) => string | null;
} {
  const ensureImage = useCallback(async (_url?: string | null) => false, []);
  const getRenderableUrl = useCallback((url?: string | null): string | null => (url ? url : null), []);

  return { ensureImage, getRenderableUrl };
}
