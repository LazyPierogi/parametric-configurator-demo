"use client";

import React, { memo } from 'react';
import { FiltersPanel } from '@/app/configure/components/FiltersPanel';

export type CurtainConfiguratorPanelProps = Record<string, any>;

export const CurtainConfiguratorPanel = memo(function CurtainConfiguratorPanel(props: CurtainConfiguratorPanelProps) {
  return <FiltersPanel {...(props as any)} />;
});
