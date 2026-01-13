'use client';

import type React from 'react';
import { cn } from '@/lib/utils';

type CurtainFirstConfigureContentProps = {
  isMobile: boolean;
  heroDockedDesktop: boolean;
  heroSection: React.ReactNode;
  debugStack: React.ReactNode;
  configuratorPanel: React.ReactNode;
  summaryNodeMobile: React.ReactNode;
};

export function CurtainFirstConfigureContent({
  isMobile,
  heroDockedDesktop,
  heroSection,
  debugStack,
  configuratorPanel,
  summaryNodeMobile,
}: CurtainFirstConfigureContentProps) {
  return (
    <div
      id="main_content_inner"
      className={cn('flex flex-col gap-3', !isMobile && 'gap-5')}
    >
      {isMobile ? (
        <div
          className="flex w-full flex-col gap-3"
          data-hero-layout={heroDockedDesktop ? 'docked' : 'centered'}
        >
          {heroSection}
          {debugStack}
          {configuratorPanel}
          <div className="mt-4 w-full">{summaryNodeMobile}</div>
        </div>
      ) : (
        <div
          className={cn(
            'flex flex-col w-full gap-3',
            heroDockedDesktop
              ? 'lg:flex-row lg:items-stretch lg:gap-4'
              : 'lg:items-center lg:gap-4 lg:justify-center',
          )}
          data-hero-layout={heroDockedDesktop ? 'docked' : 'centered'}
        >
          <div className="flex w-full flex-col lg:w-[58%] lg:min-w-[500px] lg:flex-shrink-0">
            {heroSection}
            {debugStack}
          </div>
          {configuratorPanel}
        </div>
      )}
    </div>
  );
}
