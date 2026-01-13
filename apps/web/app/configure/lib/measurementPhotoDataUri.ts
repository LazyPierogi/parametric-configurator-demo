import type { MutableRefObject } from 'react';

export type MeasurementPhotoCache = { key: string | null; dataUri: string | null };

type Args = {
  file: File | null;
  previewUrl: string | null;
  fileSignature: string | null;
  cacheRef: MutableRefObject<MeasurementPhotoCache>;
};

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image data'));
    reader.readAsDataURL(blob);
  });
}

export async function ensureMeasurementPhotoDataUri({ file, previewUrl, fileSignature, cacheRef }: Args): Promise<string> {
  const cacheKey = fileSignature || previewUrl || (file ? `${file.name}:${file.size}` : null);
  if (cacheKey && cacheRef.current.key === cacheKey && cacheRef.current.dataUri) {
    return cacheRef.current.dataUri;
  }

  let dataUri: string | null = null;
  if (file) {
    dataUri = await blobToDataUri(file);
  } else if (previewUrl) {
    if (previewUrl.startsWith('data:image/')) {
      dataUri = previewUrl;
    } else {
      const response = await fetch(previewUrl);
      if (!response.ok) {
        throw new Error('Failed to load preview image for measurement');
      }
      const blob = await response.blob();
      dataUri = await blobToDataUri(blob);
    }
  }

  if (!dataUri) {
    throw new Error('Missing photo for curtain measurement');
  }

  cacheRef.current = { key: cacheKey, dataUri };

  return dataUri;
}
