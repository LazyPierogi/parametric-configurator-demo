import { measureFromImage } from '@curtain-wizard/core/src/services/measure';
import { readFileSync } from 'node:fs';

(async () => {
  const buf = readFileSync('public/originals/sciana.HEIC');
  const dataUri = `data:image/heic;base64,${buf.toString('base64')}`;
  try {
    const res = await measureFromImage(dataUri, { provider: 'noreref', localDebug: true });
    console.log('result', res);
  } catch (err: any) {
    console.error('err', err?.message || err);
  }
})();
