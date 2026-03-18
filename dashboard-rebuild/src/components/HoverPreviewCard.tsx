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
      line: '#d9e0e8',
      fill: 'rgba(217, 224, 232, 0.16)',
      topGlow: 'from-[color:rgba(217,224,232,0.72)]',
      badge: 'bg-[color:rgba(217,224,232,0.12)] text-[color:#e5f1ff] border-[color:rgba(217,224,232,0.22)]',
      deltaText: 'text-[color:#ecf5ff]',
    };
  }

  if (delta > 0) {
    return {
      line: '#55c271',
      fill: 'rgba(85, 194, 113, 0.16)',
      topGlow: 'from-[color:rgba(85,194,113,0.8)]',
      badge: 'bg-[color:rgba(85,194,113,0.12)] text-[color:#def8e3] border-[color:rgba(85,194,113,0.24)]',
      deltaText: 'text-[color:#55c271]',
    };
  }

  if (delta < 0) {
    return {
      line: '#ff7a59',
      fill: 'rgba(255, 122, 89, 0.16)',
      topGlow: 'from-[color:rgba(255,122,89,0.8)]',
      badge: 'bg-[color:rgba(255,122,89,0.12)] text-[color:#ffd9cf] border-[color:rgba(255,122,89,0.22)]',
      deltaText: 'text-[color:#ff7a59]',
    };
  }

  return {
    line: '#d9e0e8',
    fill: 'rgba(217, 224, 232, 0.16)',
    topGlow: 'from-[color:rgba(217,224,232,0.72)]',
    badge: 'bg-[color:rgba(217,224,232,0.12)] text-[color:#e5f1ff] border-[color:rgba(217,224,232,0.22)]',
    deltaText: 'text-[color:#ecf5ff]',
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
    ? 'bg-[color:rgba(150,190,230,0.12)] text-[color:#dff2ff] border-[color:rgba(150,190,230,0.2)]'
    : 'bg-[color:rgba(30,64,124,0.22)] text-[color:#d5e8ff] border-[color:rgba(150,190,230,0.2)]';

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
      className="pointer-events-none absolute z-20 w-[min(312px,calc(100vw-24px))]"
      style={{ left, top }}
      aria-hidden="true"
    >
      <div className="relative overflow-hidden rounded-[22px] border border-[color:rgba(150,190,230,0.14)] bg-[linear-gradient(180deg,rgba(8,24,46,0.92),rgba(4,14,28,0.94))] shadow-[0_24px_70px_rgba(2,6,23,0.55)] backdrop-blur-2xl">
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${tone.topGlow} via-white/20 to-transparent`} />
        <div className="pointer-events-none absolute -right-10 top-0 h-24 w-24 rounded-full bg-[color:rgba(150,190,230,0.08)] blur-3xl" />

        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${typeBadge}`}>
                  {preview.kind === 'park' ? 'Park' : 'County'}
                </span>
                <h3 className="mt-2 text-sm font-semibold leading-snug text-white">{preview.title}</h3>
                {preview.subtitle ? (
                  <p className="mt-1 text-xs text-[color:#adc6e4]">{preview.subtitle}</p>
                ) : null}
              </div>

              <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-medium ${tone.badge}`}>
                {preview.delta == null ? 'Neutral' : preview.delta > 0 ? 'Up' : preview.delta < 0 ? 'Down' : 'Flat'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-[color:rgba(150,190,230,0.08)] bg-[color:rgba(255,255,255,0.03)] px-3 py-2.5">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[color:#7e98b7]">Pre-COVID</div>
              <div className="mt-1 text-sm font-semibold text-[color:#ecf5ff]">{formatMetric(preview.pre)}</div>
            </div>
            <div className="rounded-2xl border border-[color:rgba(150,190,230,0.08)] bg-[color:rgba(255,255,255,0.03)] px-3 py-2.5">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[color:#7e98b7]">Post-COVID</div>
              <div className="mt-1 text-sm font-semibold text-[color:#ecf5ff]">{formatMetric(preview.post)}</div>
            </div>
            <div className="rounded-2xl border border-[color:rgba(150,190,230,0.08)] bg-[color:rgba(255,255,255,0.03)] px-3 py-2.5">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[color:#7e98b7]">Delta</div>
              <div className={`mt-1 text-sm font-semibold ${tone.deltaText}`}>{formatDelta(preview.delta)}</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[20px] border border-[color:rgba(150,190,230,0.08)] bg-[color:rgba(255,255,255,0.025)]">
            {preview.trendPoints.length > 1 ? (
              <MiniTrendSparkline points={preview.trendPoints} stroke={tone.line} fill={tone.fill} />
            ) : (
              <TrendPlaceholder empty={preview.status === 'No telemetry available'} />
            )}
          </div>

          {preview.status ? (
            <div className="flex items-center gap-2 text-[11px] text-[color:#adc6e4]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:#7e98b7]" />
              <span>{preview.status}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
