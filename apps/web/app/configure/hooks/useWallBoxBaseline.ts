import { useLayoutEffect, type RefObject } from 'react';
import { animateWallBoxToConfigurator, prepareConfiguratorPanelEntry } from '@/lib/motion-utils';

type BoxRatio = { w: number; h: number };

type Args<THero extends HTMLElement, TPanel extends HTMLElement> = {
  isReady: boolean;
  boxRatio: BoxRatio;
  curtainHeroRef: RefObject<THero | null>;
  configuratorPanelRef: RefObject<TPanel | null>;
  baseBoxRatio: BoxRatio | null;
  setBaseBoxRatio: (next: BoxRatio | null) => void;
};

export function useWallBoxBaseline<THero extends HTMLElement, TPanel extends HTMLElement>({
  isReady,
  boxRatio,
  curtainHeroRef,
  configuratorPanelRef,
  baseBoxRatio,
  setBaseBoxRatio,
}: Args<THero, TPanel>) {
  useLayoutEffect(() => {
    if (isReady && !baseBoxRatio && boxRatio.w > 0 && boxRatio.h > 0) {
      setBaseBoxRatio({ w: boxRatio.w, h: boxRatio.h });
      prepareConfiguratorPanelEntry(configuratorPanelRef.current);
      requestAnimationFrame(() => {
        animateWallBoxToConfigurator(curtainHeroRef.current, configuratorPanelRef.current);
      });
    }
  }, [isReady, baseBoxRatio, boxRatio, curtainHeroRef, configuratorPanelRef, setBaseBoxRatio]);
}
