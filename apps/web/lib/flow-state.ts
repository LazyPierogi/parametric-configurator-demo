import { STORAGE_KEYS } from './storage-keys';

const FLOW_STATE_KEY = STORAGE_KEYS.FLOW_STATE;
const LAST_UPLOADED_KEY = STORAGE_KEYS.LAST_UPLOADED;

export type FlowMeasurement = {
  wallWidthCm: number;
  wallHeightCm: number;
  provider: 'googleai' | 'openai' | 'qwen' | 'localcv' | 'noreref';
  model: string;
  elapsedMs?: number;
  confidencePct?: number | null;
  warnings?: string[] | null;
  usedFallback?: boolean;
  fallbackProvider?: string | null;
};

export type FlowState = {
  measurement: FlowMeasurement;
  curtainPolygon?: Array<{ x: number; y: number }>;
  segmentKey: string;
  photoName?: string | null;
  photoUrl?: string | null;
  photoType?: string | null;
  photoSize?: number | null;
  createdAt: number;
  bypassCache?: boolean;
  flowMode?: 'legacy' | 'new';
  schemaVersion?: number;
};

export function storeFlowState(state: FlowState): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: FlowState = {
      schemaVersion: 2,
      flowMode: state.flowMode ?? 'new',
      ...state,
    };
    sessionStorage.setItem(FLOW_STATE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors (quota, private mode)
  }
}

export function peekFlowState(): FlowState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(FLOW_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FlowState | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.segmentKey || !parsed.measurement) return null;
    return {
      ...parsed,
      flowMode: parsed.flowMode === 'legacy' ? 'legacy' : 'new',
      schemaVersion: parsed.schemaVersion ?? 2,
    };
  } catch {
    return null;
  }
}

export function consumeFlowState(): FlowState | null {
  const state = peekFlowState();
  if (state) {
    clearFlowState();
  }
  return state;
}

export function clearFlowState(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(FLOW_STATE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function setLastUploadedKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(LAST_UPLOADED_KEY, key);
  } catch {
    // ignore storage errors
  }
}

export function getLastUploadedKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(LAST_UPLOADED_KEY);
    return v || null;
  } catch {
    return null;
  }
}
