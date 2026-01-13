import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  clearMeasurementObservations,
  getMeasurementObservations,
  subscribeMeasurementObservations,
  type MeasurementObservation,
} from '@/lib/measurement-observer';

type MeasurementDiagnosticsPanelProps = {
  visible: boolean;
};

type SummaryRow = {
  label: string;
  value: string;
};

function formatTime(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toISOString();
  }
}

function formatNumber(value: number | undefined, fractionDigits = 1): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    return value.toFixed(fractionDigits);
  }
}

function buildSummary(observations: MeasurementObservation[]): SummaryRow[] {
  if (!observations.length) {
    return [
      { label: 'Entries', value: '0' },
      { label: 'Prompt variants', value: '0' },
    ];
  }
  const success = observations.filter((obs) => obs.status === 'success');
  const errors = observations.length - success.length;
  const avgElapsed =
    success.reduce((acc, obs) => acc + (obs.elapsedMs ?? 0), 0) /
    Math.max(1, success.length);
  const promptVariants = new Set(
    observations
      .map((obs) => obs.promptHash || obs.prompt || 'none')
      .filter(Boolean),
  );
  const avgWidth =
    success.reduce((acc, obs) => acc + (obs.wallWidthCm ?? 0), 0) /
    Math.max(1, success.length);
  const avgHeight =
    success.reduce((acc, obs) => acc + (obs.wallHeightCm ?? 0), 0) /
    Math.max(1, success.length);
  const avgArea =
    success.reduce(
      (acc, obs) => acc + (obs.polygonSummary?.areaPct ?? 0),
      0,
    ) / Math.max(1, success.length);

  return [
    { label: 'Entries', value: `${observations.length} (${success.length} ok / ${errors} err)` },
    { label: 'Prompt variants', value: `${promptVariants.size}` },
    { label: 'Avg elapsed', value: `${formatNumber(avgElapsed, 0)} ms` },
    { label: 'Avg width', value: `${formatNumber(avgWidth)} cm` },
    { label: 'Avg height', value: `${formatNumber(avgHeight)} cm` },
    { label: 'Avg area', value: `${formatNumber(avgArea)}% of frame` },
  ];
}

async function copyToClipboard(text: string): Promise<void> {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignoring clipboard errors keeps diagnostics non-blocking
  }
}

function downloadJson(data: unknown, filename: string): void {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch {
    // ignore download failures
  }
}

function downloadCsv(observations: MeasurementObservation[], filename: string): void {
  try {
    const headers = [
      'id',
      'createdAt',
      'status',
      'flowMode',
      'source',
      'provider',
      'model',
      'elapsedMs',
      'wallWidthCm',
      'wallHeightCm',
      'confidencePct',
      'usedFallback',
      'fallbackProvider',
      'polygonWidthPct',
      'polygonHeightPct',
      'polygonAreaPct',
      'warnings',
      'error',
      'cacheKey',
    ];
    
    const rows = observations.map((obs) => [
      obs.id,
      new Date(obs.createdAt).toISOString(),
      obs.status,
      obs.flowMode,
      obs.source ?? '',
      obs.provider ?? '',
      obs.model ?? '',
      obs.elapsedMs ?? '',
      obs.wallWidthCm ?? '',
      obs.wallHeightCm ?? '',
      obs.confidencePct ?? '',
      obs.usedFallback ? 'yes' : 'no',
      obs.fallbackProvider ?? '',
      obs.polygonSummary?.widthPct ?? '',
      obs.polygonSummary?.heightPct ?? '',
      obs.polygonSummary?.areaPct ?? '',
      (obs.warnings ?? []).join('; '),
      obs.error ?? '',
      obs.cacheKey ?? '',
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch {
    // ignore download failures
  }
}

export function MeasurementDiagnosticsPanel({
  visible,
}: MeasurementDiagnosticsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [observations, setObservations] = useState<MeasurementObservation[]>([]);

  useEffect(() => {
    if (!visible) return;
    setObservations(getMeasurementObservations());
    const unsubscribe = subscribeMeasurementObservations((entries) => {
      setObservations(entries);
    });
    return () => {
      unsubscribe();
    };
  }, [visible]);

  const summary = useMemo(() => buildSummary(observations), [observations]);

  if (!visible) return null;

  return (
    <div className="mt-3 rounded-lg border border-active-border bg-active-bg p-4">
      <div className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="m-0 text-base font-semibold">Measurement Diagnostics</h3>
          <p className="m-0 mt-1 text-xs text-neutral-600">
            Capture AI #1 outputs per polygon to review prompt behaviour and accuracy.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? 'Hide Entries' : 'Show Entries'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              downloadJson(observations, `cw-measurements-${Date.now()}.json`)
            }
            disabled={!observations.length}
          >
            JSON
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              downloadCsv(observations, `cw-measurements-${Date.now()}.csv`)
            }
            disabled={!observations.length}
          >
            CSV
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => clearMeasurementObservations()}
            disabled={!observations.length}
          >
            Clear
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        {summary.map((item) => (
          <div key={item.label} className="flex justify-between gap-2">
            <dt className="font-semibold text-neutral-600">{item.label}</dt>
            <dd className="text-neutral-800">{item.value}</dd>
          </div>
        ))}
      </dl>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2 overflow-y-auto max-h-[320px] pr-1">
          {!observations.length && (
            <div className="rounded border border border-neutral-300 bg-white p-3 text-xs text-neutral-500">
              Trigger a curtain measurement to populate diagnostics.
            </div>
          )}
          {observations.map((obs) => {
            const statusColor =
              obs.status === 'success' ? 'text-emerald-600' : 'text-rose-600';
            const warnings = obs.warnings ?? [];
            return (
              <div
                key={obs.id}
                className="rounded border border-neutral-200 bg-white p-3 text-xs text-neutral-700 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className={`font-semibold ${statusColor}`}>
                      {obs.status.toUpperCase()}
                    </span>
                    <span className="text-neutral-500">{formatTime(obs.createdAt)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {obs.prompt && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(obs.prompt ?? '')}
                      >
                        Copy Prompt
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(JSON.stringify(obs, null, 2))}
                    >
                      Copy JSON
                    </Button>
                  </div>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-4">
                  <div>
                    <div className="text-neutral-500">Provider</div>
                    <div className="font-mono text-[11px]">
                      {obs.provider || 'n/a'}
                    </div>
                  </div>
                  <div>
                    <div className="text-neutral-500">Model</div>
                    <div className="font-mono text-[11px]">
                      {obs.model || 'n/a'}
                    </div>
                  </div>
                  <div>
                    <div className="text-neutral-500">Elapsed</div>
                    <div>{obs.elapsedMs != null ? `${obs.elapsedMs} ms` : '—'}</div>
                  </div>
                  <div>
                    <div className="text-neutral-500">Confidence</div>
                    <div>{obs.confidencePct != null ? `${formatNumber(obs.confidencePct)}%` : '—'}</div>
                  </div>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-4">
                  <div>
                    <div className="text-neutral-500">Flow</div>
                    <div className="font-mono text-[11px]">{obs.flowMode}</div>
                  </div>
                  <div>
                    <div className="text-neutral-500">Source</div>
                    <div className="font-mono text-[11px]">{obs.source || 'n/a'}</div>
                  </div>
                  <div>
                    <div className="text-neutral-500">Fallback</div>
                    <div>{obs.usedFallback ? 'yes' : 'no'}</div>
                  </div>
                  <div>
                    <div className="text-neutral-500">Fallback provider</div>
                    <div className="font-mono text-[11px]">
                      {obs.fallbackProvider != null && obs.fallbackProvider !== ''
                        ? obs.fallbackProvider
                        : '—'}
                    </div>
                  </div>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3">
                  <div>
                    <div className="text-neutral-500">Width</div>
                    <div>{obs.wallWidthCm != null ? `${formatNumber(obs.wallWidthCm)} cm` : '—'}</div>
                  </div>
                  <div>
                    <div className="text-neutral-500">Height</div>
                    <div>{obs.wallHeightCm != null ? `${formatNumber(obs.wallHeightCm)} cm` : '—'}</div>
                  </div>
                  <div>
                    <div className="text-neutral-500">Polygon area</div>
                    <div>
                      {obs.polygonSummary
                        ? `${formatNumber(obs.polygonSummary.areaPct)}%`
                        : '—'}
                    </div>
                  </div>
                </div>
                {warnings.length > 0 && (
                  <div className="mt-1 rounded bg-amber-50 p-2 text-[11px] text-amber-700">
                    <div className="font-semibold">Warnings</div>
                    <ul className="mt-1 list-disc pl-4">
                      {warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {obs.error && (
                  <div className="mt-1 rounded bg-rose-50 p-2 text-[11px] text-rose-700">
                    <div className="font-semibold">Error</div>
                    <div>{obs.error}</div>
                  </div>
                )}
                {obs.polygon && obs.polygon.length > 0 && (
                  <div className="mt-1 rounded bg-neutral-50 p-2 font-mono text-[11px] leading-relaxed text-neutral-700">
                    Polygon:{' '}
                    {obs.polygon
                      .map((pt, idx) => `P${idx + 1}(${pt.x.toFixed(4)}, ${pt.y.toFixed(4)})`)
                      .join('  ')}
                  </div>
                )}
                {obs.prompt && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-neutral-500">
                      Prompt Details
                    </summary>
                    <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded border border-neutral-200 bg-neutral-50 p-2 text-[11px] leading-snug text-neutral-700">
                      {obs.prompt}
                    </pre>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
