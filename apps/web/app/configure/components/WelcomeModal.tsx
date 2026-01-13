'use client';

import { RefObject, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '@/lib/storage-keys';
import { Button } from '@/components/ui/Button';

const WELCOME_STORAGE_KEY = STORAGE_KEYS.WELCOME_DISMISSED;

interface WelcomeModalProps {
  isReady: boolean;
  t: (key: string) => string;
  anchorHeroRef?: RefObject<HTMLElement | null>;
  anchorPanelRef?: RefObject<HTMLElement | null>;
}

export function WelcomeModal({ isReady, t }: WelcomeModalProps) {
  const [show, setShow] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  const [hasSeenBefore, setHasSeenBefore] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(WELCOME_STORAGE_KEY);
    setHasSeenBefore(Boolean(stored));
  }, []);

  useEffect(() => {
    // Only show once per session after ready
    if (hasShown || hasSeenBefore || !isReady) return;
    const timer = setTimeout(() => {
      setShow(true);
      setHasShown(true);
    },300);
    return () => clearTimeout(timer);
  }, [isReady, hasShown, hasSeenBefore]);

  if (!show) return null;

  const markAsSeen = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(WELCOME_STORAGE_KEY, '1');
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
      onClick={() => {
        setShow(false);
        markAsSeen();
      }}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="text-2xl font-bold mb-3 text-active-text">
            {t('configure.welcome.title')}
          </div>
          <div className="text-neutral-700 space-y-2 mb-5">
            <p dangerouslySetInnerHTML={{ __html: t('configure.welcome.instructions') }} />
            <p dangerouslySetInnerHTML={{ __html: t('configure.welcome.adjust') }} />
            <p dangerouslySetInnerHTML={{ __html: t('configure.welcome.summary') }} />
            <p dangerouslySetInnerHTML={{ __html: t('configure.welcome.screen') }} />
            <p className="text-sm text-neutral-500 mt-3">
              {t('configure.welcome.footer')}
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            fullWidth
            onClick={() => {
              setShow(false);
              markAsSeen();
            }}
            className="rounded-xl"
          >
            {t('configure.welcome.gotIt')}
          </Button>
        </div>
      </div>
    </div>
  );
}
