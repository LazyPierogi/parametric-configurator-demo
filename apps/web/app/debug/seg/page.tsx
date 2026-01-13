"use client";

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocale } from '@/app/providers/locale-context';

export default function SegDebugPage() {
  const { t } = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [layers, setLayers] = useState(true);
  const [maskUrl, setMaskUrl] = useState<string | null>(null);
  const [attachedUrl, setAttachedUrl] = useState<string | null>(null);
  const [proposalUrl, setProposalUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!file) return;
    setBusy(true); setError(null); setMaskUrl(null); setAttachedUrl(null); setProposalUrl(null);
    try {
      const t0 = performance.now();
      const fd = new FormData();
      fd.append('image', file);
      if (layers) fd.append('layers', '1');
      const res = await fetch('/api/segment', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      if (layers) {
        const json = await res.json();
        setMaskUrl(json.final_mask);
        setAttachedUrl(json.attached_on_wall || null);
        setProposalUrl(json.proposal_union || null);
        if (typeof json.elapsed_ms === 'number') setElapsed(json.elapsed_ms);
        else setElapsed(Math.round(performance.now() - t0));
        const ms = typeof json.elapsed_ms === 'number' ? json.elapsed_ms : Math.round(performance.now() - t0);
        toast.success(t('debugSeg.toastSegmentedElapsed', { time: ms.toString() }));
      } else {
        const blob = await res.blob();
        setMaskUrl(URL.createObjectURL(blob));
        const hdr = res.headers.get('X-Elapsed-MS');
        setElapsed(hdr ? Number(hdr) : Math.round(performance.now() - t0));
        toast.success(t('debugSeg.toastSegmentedElapsed', { time: (hdr || Math.round(performance.now() - t0)).toString() }));
      }
    } catch (e: any) {
      console.error('[debug/seg] request failed', e);
      setError(t('debugSeg.requestFailed'));
      toast.error(t('debugSeg.segFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-5">
      <h1>{t('debugSeg.title')}</h1>
      <p>{t('debugSeg.intro')}</p>
      <div className="flex gap-3 items-center">
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <label className="inline-flex gap-1.5 items-center">
          <input type="checkbox" checked={layers} onChange={(e) => setLayers(e.target.checked)} /> {t('debugSeg.layers')}
        </label>
        <button disabled={!file || busy} onClick={run}>{busy ? t('debugSeg.running') : t('debugSeg.run')}</button>
      </div>
      {error && <pre className="text-error whitespace-pre-wrap">{error}</pre>}
      {maskUrl && (
        <div className="mt-4 flex gap-4 flex-wrap">
          <div>
            <div>{t('debugSeg.finalMask')}</div>
            <img src={maskUrl} className="max-w-[400px] border border-neutral-300" />
          </div>
          {attachedUrl && (
            <div>
              <div>{t('debugSeg.attachedOnWall')}</div>
              <img src={attachedUrl} className="max-w-[400px] border border-neutral-300" />
            </div>
          )}
          {proposalUrl && (
            <div>
              <div>{t('debugSeg.proposalUnion')}</div>
              <img src={proposalUrl} className="max-w-[400px] border border-neutral-300" />
            </div>
          )}
          <div className="min-w-[200px]">
            <div><b>{t('debugSeg.timing')}</b></div>
            <div>{t('debugSeg.elapsed', { time: elapsed != null ? elapsed.toString() : 'n/a' })}</div>
          </div>
        </div>
      )}
    </div>
  );
}
