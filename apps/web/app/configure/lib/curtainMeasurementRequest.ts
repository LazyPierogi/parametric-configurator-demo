export type MeasureOut = {
  wallWidthCm: number;
  wallHeightCm: number;
  confidencePct?: number;
  warnings?: string[];
  usedFallback?: boolean;
  fallbackProvider?: string;
};

export async function requestCurtainMeasurement(
  payload: Record<string, unknown>,
  opts?: { timeoutMs?: number },
): Promise<{ json: MeasureOut; elapsedMs: number }> {
  const started = performance.now();
  const controller = new AbortController();
  const timeoutMs = opts?.timeoutMs ?? 20000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch('/api/measure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    } as RequestInit);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const json = (await response.json()) as MeasureOut;
  const elapsedMs = Math.round(performance.now() - started);
  return { json, elapsedMs };
}

export function formatCurtainMeasurementError(error: unknown): string {
  let message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : 'Curtain measurement failed';

  if (message === 'The user aborted a request.' || message === 'signal is aborted without reason') {
    message = 'Curtain measurement timed out after 20s';
  }

  if (message.startsWith('{')) {
    try {
      const parsed = JSON.parse(message);
      if (parsed && typeof parsed.error === 'string') {
        message = parsed.error;
      }
    } catch {
      // ignore parse failure
    }
  }

  return message;
}
