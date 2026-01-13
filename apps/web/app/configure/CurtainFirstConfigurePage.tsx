"use client";

import { Suspense } from 'react';
import { CurtainFirstConfigurePageContent } from './CurtainFirstConfigurePageContent';

export default function CurtainFirstConfigurePage() {
  return (
    <Suspense fallback={null}>
      <CurtainFirstConfigurePageContent />
    </Suspense>
  );
}
