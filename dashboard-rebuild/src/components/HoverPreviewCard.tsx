import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { HoverPreviewData, TrendPoint } from '../lib/hoverPreview';

interface HoverPreviewCardProps {
  preview: HoverPreviewData;
  position: { x: number; y: number };
  bounds: { width: number; height: number };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatMetric(value: number | null) {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatDelta(value: number | null) {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

function getTone(delta: number | null) {
  if (delta == null || !Number.isFinite(delta)) {
    return {
      line: '#94a3b8',
      fill: 'rgba(148, 163, 184, 0.16)',
      topGlow: 'from-slate-300/70',
      badge: 'bg-slate-400/10 text-slate-200 border-slate-300/15',
      deltaText: 'text-slate-200',
    };
  }

  if (delta > 0) {
    return {
      line: '#10b981',
      fill: 'rgba(16, 185, 129, 0.16)',
      topGlow: 'from-emerald-400/80',
      badge: 'bg-emerald-400/10 text-emerald-200 border-emerald-300/15',
      deltaText: 'text-emerald-300',
    };
  }

  if (delta < 0) {
    return {
      line: '#f43f5e',
      fill: 'rgba(244, 63, 94, 0.16)',
      topGlow: 'from-rose-400/80',
      badge: 'bg-rose-400/10 text-rose-200 border-rose-300/15',
      deltaText: 'text-rose-300',
    };
  }

  return {
    line: '#94a3b8',
    fill: 'rgba(148, 163, 184, 0.16)',
    topGlow: 'from-slate-300/70',
    badge: 'bg-slate-400/10 text-slate-200 border-slate-300/15',
    deltaText: 'text-slate-200',
  };
}

function MiniTrendSparkline({ points, stroke, fill }: { points: TrendPoint[]; stroke: string; fill: string }) {
  const width = 280;
  const height = 78;
  const padding = 6;

  const { linePoints, areaPath } = useMemo(() => {
    if (points.length < 2) {
      return { linePoints: '', areaPath: '' };
    }

    const values = points.map((point) => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;

    const coordinates = points.map((point, index) => {
      const x = padding + (index / (points.length - 1)) * (width - padding * 2);
      const normalizedY = (point.value - minValue) / range;
      const y = height - padding - normalizedY * (height - padding * 2);
      return { x, y };
    });

    const linePointsValue = coordinates.map(({ x, y }) => `${x},${y}`).join(' ');
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    const areaPathValue = [
      `M ${first.x} ${height - padding}`,
      ...coordinates.map(({ x, y }) => `L ${x} ${y}`),
      `L ${last.x} ${height - padding}`,
      'Z',
    ].join(' ');

    return { linePoints: linePointsValue, areaPath: areaPathValue };
  }, [points]);

  if (!linePoints) return null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[84px] w-full" preserveAspectRatio="none" aria-hidden="true">
      <path d={areaPath} fill={fill} />
      <polyline
        points={linePoints}
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrendPlaceholder({ empty }: { empty: boolean }) {
  if (empty) {
    return (
      <div className="flex h-[84px] items-center justify-center">
        <div className="w-24 border-t border-dashed border-slate-600/80" />
      </div>
    );
  }

  return (
    <div className="flex h-[84px] items-center px-3">
      <div className="h-full w-full animate-pulse rounded-2xl bg-gradient-to-r from-slate-700/30 via-slate-600/20 to-slate-700/30" />
    </div>
  );
}

export default function HoverPreviewCard({ preview, position, bounds }: HoverPreviewCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState({ width: 312, height: 238 });
  const tone = getTone(preview.delta);
  const typeBadge = preview.kind === 'park'
    ? 'bg-sky-400/10 text-sky-200 border-sky-300/15'
    : 'bg-amber-400/10 text-amber-200 border-amber-300/15';

  useLayoutEffect(() => {
    if (!cardRef.current) return;

    setCardSize({
      width: cardRef.current.offsetWidth || 312,
      height: cardRef.current.offsetHeight || 238,
    });
  }, [preview]);

  const leftLimit = Math.max(12, bounds.width - cardSize.width - 12);
  const topLimit = Math.max(12, bounds.height - cardSize.height - 12);
  const left = clamp(position.x + 18, 12, leftLimit);
  const top = clamp(position.y + 18, 12, topLimit);

  return (
    <div
      ref={cardRef}
      className="pointer-events-none absolute z-20 w-[312px]"
      style={{ left, top }}
      aria-hidden="true"
    >
      <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-slate-900/88 shadow-[0_24px_70px_rgba(2,6,23,0.55)] backdrop-blur-2xl">
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${tone.topGlow} via-white/20 to-transparent`} />
        <div className="pointer-events-none absolute -right-10 top-0 h-24 w-24 rounded-full bg-white/5 blur-3xl" />

        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${typeBadge}`}>
                  {preview.kind === 'park' ? 'Park' : 'County'}
                </span>
                <h3 className="mt-2 text-sm font-semibold leading-snug text-white">{preview.title}</h3>
                {preview.subtitle ? (
                  <p className="mt-1 text-xs text-slate-400">{preview.subtitle}</p>
                ) : null}
              </div>

              <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-medium ${tone.badge}`}>
                {preview.delta == null ? 'Neutral' : preview.delta > 0 ? 'Up' : preview.delta < 0 ? 'Down' : 'Flat'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/5 bg-black/30 px-3 py-2.5">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">Pre-COVID</div>
              <div className="mt-1 text-sm font-semibold text-slate-100">{formatMetric(preview.pre)}</div>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/30 px-3 py-2.5">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">Post-COVID</div>
              <div className="mt-1 text-sm font-semibold text-slate-100">{formatMetric(preview.post)}</div>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/30 px-3 py-2.5">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">Delta</div>
              <div className={`mt-1 text-sm font-semibold ${tone.deltaText}`}>{formatDelta(preview.delta)}</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[20px] border border-white/6 bg-black/25">
            {preview.trendPoints.length > 1 ? (
              <MiniTrendSparkline points={preview.trendPoints} stroke={tone.line} fill={tone.fill} />
            ) : (
              <TrendPlaceholder empty={preview.status === 'No telemetry available'} />
            )}
          </div>

          {preview.status ? (
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
              <span>{preview.status}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
