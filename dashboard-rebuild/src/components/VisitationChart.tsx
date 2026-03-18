import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface VisitationChartProps {
  compact?: boolean;
  data: Record<string, string | number | null | undefined>;
  parkName: string;
  mode: 'line' | 'overlay';
}

const COVID_START = new Date('2020-02-28');
const POSITIVE = '#55c271';
const NEUTRAL = '#d9e0e8';

export default function VisitationChart({
  compact = false,
  data,
  parkName,
  mode,
}: VisitationChartProps) {
  const { lineData, overlayData } = useMemo(() => {
    if (!data || Object.keys(data).length === 0) {
      return { lineData: [], overlayData: [] };
    }

    const rawPoints: { date: Date; value: number }[] = [];
    const preByMonth: Record<number, number[]> = {};
    const postByMonth: Record<number, number[]> = {};

    for (const [key, value] of Object.entries(data)) {
      const d = new Date(key);
      if (Number.isNaN(d.getTime())) continue;
      const numVal = Number(value);
      if (Number.isNaN(numVal)) continue;

      rawPoints.push({ date: d, value: numVal });

      const month = d.getMonth();
      if (d < COVID_START) {
        (preByMonth[month] = preByMonth[month] || []).push(numVal);
      } else {
        (postByMonth[month] = postByMonth[month] || []).push(numVal);
      }
    }

    rawPoints.sort((a, b) => a.date.getTime() - b.date.getTime());
    const lineData = rawPoints.map((point) => ({
      date: point.date.toISOString().slice(0, 7),
      visitors: point.value,
    }));

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const overlayData = monthNames.map((name, index) => {
      const preArr = preByMonth[index] || [];
      const postArr = postByMonth[index] || [];
      return {
        month: name,
        preCovid: preArr.length ? Math.round(preArr.reduce((a, b) => a + b) / preArr.length) : null,
        postCovid: postArr.length ? Math.round(postArr.reduce((a, b) => a + b) / postArr.length) : null,
      };
    });

    return { lineData, overlayData };
  }, [data]);

  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="flex min-h-[15rem] flex-col items-center justify-center rounded-[1.35rem] border border-dashed border-[color:rgba(150,190,230,0.16)] bg-[linear-gradient(180deg,rgba(8,24,46,0.82),rgba(4,14,28,0.92))] px-6 text-center">
        <div className="font-display text-lg font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
          No visitation data available
        </div>
        <div className="mt-2 max-w-sm text-sm leading-6 text-[var(--color-text-secondary)]">
          Historical data is unavailable for this location.
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.4rem] border border-[color:rgba(150,190,230,0.14)] bg-[linear-gradient(180deg,rgba(8,24,46,0.86),rgba(4,14,28,0.9))]">
      <div className="border-b border-[color:rgba(150,190,230,0.12)] px-4 py-3 md:px-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-text-tertiary)]">
              {mode === 'line' ? 'Timeline' : 'Pre / Post'}
            </div>
            <div className="mt-1.5 font-display text-xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
              {parkName}
            </div>
            <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {mode === 'line'
                ? 'Monthly visits over time.'
                : 'Average month-by-month visits before and after February 2020.'}
            </div>
          </div>

          {mode === 'overlay' ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(217,224,232,0.22)] bg-[color:rgba(217,224,232,0.08)] px-2.5 py-1.5 text-[var(--color-data-neutral)]">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-data-neutral)]" />
                Pre-COVID
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(85,194,113,0.22)] bg-[color:rgba(85,194,113,0.08)] px-2.5 py-1.5 text-[var(--color-data-positive)]">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-data-positive)]" />
                Post-COVID
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className={`px-3 pb-3 pt-3 md:px-4 md:pb-4 ${compact ? 'h-[18.5rem]' : 'h-[19.5rem]'}`}>
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'line' ? (
            <LineChart data={lineData} margin={{ top: 10, right: compact ? 6 : 18, left: compact ? 2 : 8, bottom: 0 }}>
              <defs>
                <linearGradient id="timelineStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#96bee6" />
                  <stop offset="100%" stopColor="#6fdcff" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,190,230,0.12)" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                minTickGap={compact ? 24 : 18}
                tick={{ fill: '#7e98b7', fontSize: compact ? 10 : 11 }}
                tickFormatter={(value) => compact ? value.slice(2).replace('-', '/') : value}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#7e98b7', fontSize: compact ? 10 : 11 }}
                width={compact ? 0 : 56}
                hide={compact}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(150,190,230,0.25)', strokeDasharray: '4 4' }}
                contentStyle={{
                  background: 'rgba(5, 18, 33, 0.96)',
                  border: '1px solid rgba(150,190,230,0.18)',
                  borderRadius: 18,
                  color: '#ecf5ff',
                  boxShadow: '0 18px 40px rgba(0, 10, 24, 0.45)',
                }}
                labelStyle={{ color: '#adc6e4' }}
              />
              <Line
                type="monotone"
                dataKey="visitors"
                stroke="url(#timelineStroke)"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: '#96bee6' }}
              />
            </LineChart>
          ) : (
            <LineChart data={overlayData} margin={{ top: 10, right: compact ? 6 : 18, left: compact ? 2 : 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,190,230,0.12)" vertical={false} />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#7e98b7', fontSize: compact ? 10 : 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#7e98b7', fontSize: compact ? 10 : 11 }}
                width={compact ? 0 : 56}
                hide={compact}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(150,190,230,0.25)', strokeDasharray: '4 4' }}
                contentStyle={{
                  background: 'rgba(5, 18, 33, 0.96)',
                  border: '1px solid rgba(150,190,230,0.18)',
                  borderRadius: 18,
                  color: '#ecf5ff',
                  boxShadow: '0 18px 40px rgba(0, 10, 24, 0.45)',
                }}
                labelStyle={{ color: '#adc6e4' }}
              />
              {!compact ? (
                <Legend wrapperStyle={{ color: '#adc6e4', fontSize: 11, paddingTop: 8 }} />
              ) : null}
              <Line
                type="monotone"
                dataKey="preCovid"
                name="Pre-COVID"
                stroke={NEUTRAL}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: NEUTRAL }}
              />
              <Line
                type="monotone"
                dataKey="postCovid"
                name="Post-COVID"
                stroke={POSITIVE}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: POSITIVE }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
