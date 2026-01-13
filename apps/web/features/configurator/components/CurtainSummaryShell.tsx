"use client";

import { memo } from 'react';
import { SummaryPanel, type SummaryPanelProps } from '@/app/configure/components/SummaryPanel';

export type CurtainSummaryShellProps = SummaryPanelProps;

export const CurtainSummaryShell = memo(function CurtainSummaryShell(props: CurtainSummaryShellProps) {
  return <SummaryPanel {...props} />;
});
