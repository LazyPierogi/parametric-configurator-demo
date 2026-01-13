"use client";

import { useEffect, useState } from 'react';

export function useIsEmbed(): boolean {
  const [isEmbed, setIsEmbed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsEmbed(window.self !== window.top);
  }, []);

  return isEmbed;
}
