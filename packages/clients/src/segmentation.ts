export type LocalSegmentationOptions = {
  url: string; // e.g. http://127.0.0.1:8000/segment
  model?: 'mask2former_ade20k';
  threshold?: number; // 0..1
  mask?: 'combined' | 'wall' | 'window' | 'attached';
  labels?: string; // CSV override for X-Labels
  debug?: boolean;
  reload?: boolean;
};

/** Minimal client for the local FastAPI segmentation service. */
export async function fetchLocalSegmentation(
  image: Buffer,
  opts: LocalSegmentationOptions
): Promise<Buffer> {
  const url = opts.url;
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'X-Model': opts.model || 'mask2former_ade20k',
    'X-Threshold': String(typeof opts.threshold === 'number' ? opts.threshold : 0.6),
  };
  if (opts.mask) headers['X-Mask'] = opts.mask;
  if (opts.labels) headers['X-Labels'] = opts.labels;
  if (opts.debug) headers['X-Debug'] = '1';
  if (opts.reload) headers['X-Reload'] = '1';
  const res = await fetch(url, { method: 'POST', headers, body: image } as any);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Local segmentation error ${res.status}: ${txt}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

