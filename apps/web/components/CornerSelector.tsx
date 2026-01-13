"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

type Pt = { x: number; y: number }; // normalized 0..1

export function CornerSelector({
  imgSrc,
  value,
  onChange,
}: {
  imgSrc: string;
  value?: Pt[];
  onChange?: (pts: Pt[]) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [picks, setPicks] = useState<Pt[]>([]);
  const [confirming, setConfirming] = useState(false);

  // track image size
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const img = el.querySelector('img'); if (!img) return;
    const update = () => setImgSize({ w: img.clientWidth, h: img.clientHeight });
    update(); const ro = new ResizeObserver(update); ro.observe(img);
    return () => ro.disconnect();
  }, [imgSrc]);

  // Handle click to pick a corner
  const onClick = (e: React.MouseEvent) => {
    if (confirming) return;
    const el = wrapRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / (rect.width || 1);
    const y = (e.clientY - rect.top) / (rect.height || 1);
    const pt: Pt = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    setPicks(prev => {
      if (prev.length >= 4) return prev; // ignore extras
      const next = prev.concat([pt]);
      if (next.length === 4) setConfirming(true);
      return next;
    });
  };

  // Helpers to render
  const pxPts = useMemo(() => picks.map(p => ({ x: p.x * imgSize.w, y: p.y * imgSize.h })), [picks, imgSize]);

  const labels = ['Top‑Left', 'Top‑Right', 'Bottom‑Right', 'Bottom‑Left'];

  return (
    <div>
      <div ref={wrapRef} className="relative inline-block max-w-full select-none" onClick={onClick}>
        <img src={imgSrc} className="max-w-full h-auto rounded-lg" />
        <svg className="absolute left-0 top-0 w-full h-full" viewBox={`0 0 ${Math.max(imgSize.w,1)} ${Math.max(imgSize.h,1)}`}>
          {/* outline/fill: if >=3 corners, fill polygon (close shape with first point) */}
          {pxPts.length >= 3 && (
            <polygon
              points={[...pxPts, pxPts[0]].map(p => `${p.x},${p.y}`).join(' ')}
              fill="rgba(74,103,255,0.10)"
              stroke="rgba(74,103,255,0.9)"
              strokeWidth={2}
            />
          )}
          {pxPts.length >= 2 && pxPts.length < 3 && (
            <polyline
              points={pxPts.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="rgba(74,103,255,0.9)"
              strokeWidth={2}
            />
          )}
          {/* points */}
          {pxPts.map((p, ix) => (
            <g key={ix}>
              <circle cx={p.x} cy={p.y} r={7} fill="#4a67ff" stroke="#fff" strokeWidth={2} />
              <text x={p.x + 10} y={p.y - 10} fontSize={12} fill="#4a67ff" stroke="#fff" strokeWidth={0.5}>{ix + 1}</text>
            </g>
          ))}
        </svg>
      </div>

      {!confirming && (
        <div className="mt-2 text-neutral-700">
          {picks.length < 4 ? (
            <span>Mark 4 corners of the wall (start from <b>{labels[picks.length]}</b>).</span>
          ) : (
            <span>4 corners marked.</span>
          )}
        </div>
      )}

      {confirming && (
        <div className="mt-2.5 flex gap-2 items-center">
          <span>4 corners marked?</span>
          <Button variant="secondary" size="sm" onClick={() => { onChange?.(picks); setConfirming(false); }}>Yes</Button>
          <Button variant="secondary" size="sm" onClick={() => { setPicks([]); setConfirming(false); }}>Mark again</Button>
        </div>
      )}
      {!confirming && picks.length > 0 && (
        <div className="mt-2">
          <Button variant="secondary" size="sm" onClick={() => setPicks([])}>Reset corners</Button>
        </div>
      )}
    </div>
  );
}
