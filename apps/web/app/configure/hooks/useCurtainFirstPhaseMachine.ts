"use client";

import type { ChangeEvent, ClipboardEvent, DragEvent, MutableRefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { createBrowserCompatibleUrl } from '@/lib/blob-url-fallback';
import { fingerprintBlob } from '@/lib/file-signature';
import { validateAndConvertImage } from '@/lib/image-validation';
import { peekFlowState } from '@/lib/flow-state';
import type { TranslateFn } from '../types';

type Phase = 'idle' | 'segmenting' | 'mark' | 'ready' | 'restoring';

type ProgressState = { label: string; value: number | null } | null;

type RunSegmentation = (opts?: { file?: File; key?: string; force?: boolean }) => Promise<void> | void;

type UseCurtainFirstPhaseMachineArgs = {
  t: TranslateFn;
  MAX_BYTES: number;
  MAX_MB: number;
  runRef: MutableRefObject<RunSegmentation | null>;
};

export function useCurtainFirstPhaseMachine({ t, MAX_BYTES, MAX_MB, runRef }: UseCurtainFirstPhaseMachineArgs) {
  const initialFlow = typeof window !== 'undefined' ? peekFlowState() : null;
  const initialHasPolygon = Boolean(initialFlow?.curtainPolygon && initialFlow.curtainPolygon.length >= 3);
  const [file, setFile] = useState<File | null>(null);
  const [fileSignature, setFileSignature] = useState<string | null>(initialFlow?.segmentKey ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialFlow?.photoUrl ?? null);
  const [maskUrl, setMaskUrl] = useState<string | null>(null);
  const [wallMaskUrl, setWallMaskUrl] = useState<string | null>(null);
  const [attachedUrl, setAttachedUrl] = useState<string | null>(null);
  const [proposalUrl, setProposalUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [showMask, setShowMask] = useState(false);
  const [phase, setPhase] = useState<Phase>(
    initialFlow ? (initialHasPolygon ? 'restoring' : 'mark') : 'idle',
  );
  const [progress, setProgress] = useState<ProgressState>(null);
  const [dragActive, setDragActive] = useState(false);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);
  const [restoredOffline, setRestoredOffline] = useState(false);

  const dropRef = useRef<HTMLDivElement | null>(null);
  const dropCounterRef = useRef(0);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch {}
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (maskUrl?.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(maskUrl);
        } catch {}
      }
    };
  }, [maskUrl]);

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const suppress = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('dragover', suppress as any);
    el.addEventListener('dragenter', suppress as any);
    el.addEventListener('dragleave', suppress as any);
    el.addEventListener('drop', suppress as any);
    return () => {
      el.removeEventListener('dragover', suppress as any);
      el.removeEventListener('dragenter', suppress as any);
      el.removeEventListener('dragleave', suppress as any);
      el.removeEventListener('drop', suppress as any);
    };
  }, []);

  const onPick = useCallback(
    async (f: File) => {
      const validation = await validateAndConvertImage(f, MAX_BYTES);

      if (!validation.valid) {
        toast.error(validation.message || t('configure.upload.toastTooLarge', { max: MAX_MB.toString() }));
        return;
      }

      const processedFile = validation.file!;
      const wasHEIC =
        f.type.includes('heic') ||
        f.name.toLowerCase().endsWith('.heic') ||
        f.name.toLowerCase().endsWith('.heif');

      if (wasHEIC && processedFile.type === 'image/jpeg') {
        toast.success('HEIC converted to JPEG');
      }

      setMaskUrl(null);
      setWallMaskUrl(null);
      setAttachedUrl(null);
      setProposalUrl(null);
      setElapsed(null);
      setCacheNotice(null);
      setRestoredOffline(false);
      setFile(processedFile);

      try {
        const urlResult = await createBrowserCompatibleUrl(processedFile);
        setPreviewUrl(urlResult.url);
        if (!wasHEIC) {
          toast.success(t('configure.upload.toastLoaded'));
        }
      } catch (error) {
        console.error('[configure] Failed to create preview URL for uploaded file', error);
        try {
          const fallbackUrl = URL.createObjectURL(processedFile);
          setPreviewUrl(fallbackUrl);
          if (!wasHEIC) {
            toast.success(t('configure.upload.toastLoaded'));
          }
        } catch {
          toast.error(t('configure.upload.toastLoadFailed'));
        }
      }

      try {
        const sig = await fingerprintBlob(processedFile);
        setFileSignature(sig);
        runRef.current?.({ file: processedFile, key: sig });
      } catch {
        toast.error(t('configure.upload.toastCacheReadFailed'));
      }
    },
    [MAX_BYTES, MAX_MB, runRef, t],
  );

  const onInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void onPick(f);
    },
    [onPick],
  );

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dropCounterRef.current = 0;
    setDragActive(false);
  }, []);

  const onPaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) {
            void onPick(f);
            break;
          }
        }
      }
    },
    [onPick],
  );

  return {
    file,
    setFile,
    fileSignature,
    setFileSignature,
    previewUrl,
    setPreviewUrl,
    maskUrl,
    setMaskUrl,
    wallMaskUrl,
    setWallMaskUrl,
    attachedUrl,
    setAttachedUrl,
    proposalUrl,
    setProposalUrl,
    busy,
    setBusy,
    elapsed,
    setElapsed,
    showMask,
    setShowMask,
    phase,
    setPhase,
    progress,
    setProgress,
    dragActive,
    setDragActive,
    cacheNotice,
    setCacheNotice,
    restoredOffline,
    setRestoredOffline,
    dropRef,
    onDrop,
    onPaste,
    onPick,
    onInputChange,
  };
}
