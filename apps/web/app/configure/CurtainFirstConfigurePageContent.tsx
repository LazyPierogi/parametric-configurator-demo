"use client";

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import CurtainFirstConfigureOrchestrator from './CurtainFirstConfigureOrchestrator';

export function CurtainFirstConfigurePageContent() {
  const router = useRouter();
  const handleMissingFlow = useCallback(() => {
    if (typeof (window as any).__cwDisableBeforeUnload === 'function') {
      (window as any).__cwDisableBeforeUnload();
    }
    router.replace('/estimate');
  }, [router]);

  return (
    <CurtainFirstConfigureOrchestrator
      onCurtainFirstMissingFlow={handleMissingFlow}
    />
  );
}
