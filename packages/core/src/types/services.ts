export type SegmentBackend = 'local-mask2former' | 'hf-mask2former' | 'hf-segformer';

export type SegmentResult = {
  // RGBA PNG where wall/window/attached are alpha=0
  png: Buffer;
  backend: SegmentBackend;
  inputBytes: number;
};

export interface SegmentationService {
  segmentToPngAlpha(input: Buffer, debugDir?: string): Promise<SegmentResult>;
}

export type MeasureOutput = {
  wallWidthCm: number;
  wallHeightCm: number;
  confidencePct?: number;
  warnings?: string[];
  debug?: Record<string, unknown>;
  usedFallback?: boolean;
  fallbackProvider?: string;
};

export type CurtainPolygon = Array<{ x: number; y: number }>;

export type MeasureRequestOptions = {
  curtainPolygon?: CurtainPolygon;
  provider?: 'googleai' | 'openai' | 'qwen' | 'localcv' | 'noreref';
  model?: string;
  secondaryModel?: string;
  localMeasureUrl?: string;
  localDebug?: boolean;
  localScaleLongSide?: number | null;
  localRectifyEnabled?: boolean | null;
};

export interface MeasureService {
  measureFromImage(photoDataUri: string, options?: MeasureRequestOptions): Promise<MeasureOutput>;
}

export interface CurtainPricingService {
  // Placeholder; will accept configuration later
  quote(input: unknown): Promise<{ priceCents: number; currency: string }>;
}
