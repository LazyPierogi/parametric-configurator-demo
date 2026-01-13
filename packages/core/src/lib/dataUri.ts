function parseDataUri(dataUri: string): { meta: string; data: string } {
  if (!dataUri || typeof dataUri !== 'string') {
    throw new Error('Invalid data URI');
  }
  const commaIndex = dataUri.indexOf(',');
  if (commaIndex === -1) {
    throw new Error('Invalid data URI (missing comma)');
  }
  const meta = dataUri.slice(0, commaIndex);
  const data = dataUri.slice(commaIndex + 1);
  return { meta, data };
}

export function decodeDataUri(dataUri: string): { buffer: Buffer; mime: string } {
  const { meta, data } = parseDataUri(dataUri);
  const lower = meta.toLowerCase();
  const match = lower.match(/^data:([^;,]+)/);
  const mime = match && match[1] ? match[1] : 'application/octet-stream';
  if (lower.includes(';base64')) {
    try {
      return { buffer: Buffer.from(data, 'base64'), mime };
    } catch (err) {
      throw new Error(`Unable to decode base64 data URI: ${(err as Error).message}`);
    }
  }
  try {
    return { buffer: Buffer.from(decodeURIComponent(data), 'utf8'), mime };
  } catch (err) {
    throw new Error(`Unable to decode data URI: ${(err as Error).message}`);
  }
}

export function dataUriToBuffer(dataUri: string): Buffer {
  return decodeDataUri(dataUri).buffer;
}

export function bufferToDataUri(buffer: Buffer, mime: string): string {
  const safeMime = mime && typeof mime === 'string' ? mime : 'application/octet-stream';
  return `data:${safeMime};base64,${buffer.toString('base64')}`;
}
