import { useMemo } from 'react';
import {
  CartesianGrid,
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
  mode: 'line' | 'overlay';
}

const COVID_START = new Date('2020-02-28');
const POSITIVE = '#55c271';
const NEUTRAL = '#d9e0e8';

export default function VisitationChart({
  compact = false,
  data,
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
      <div className="flex min-h-[13.5rem] flex-col items-center justify-center px-3 py-6 text-center">
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
    <div className="space-y-3">
      {mode === 'overlay' ? (
        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-secondary)]">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-data-neutral)]" />
            Pre-COVID
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-data-positive)]" />
            Post-COVID
          </span>
        </div>
      ) : null}

      <div className={`${compact ? 'h-[18.5rem]' : 'h-[19.5rem]'}`}>
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
                  border: '0',
                  borderRadius: 14,
                  color: '#ecf5ff',
                  boxShadow: '0 18px 40px rgba(0, 10, 24, 0.34)',
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
                  border: '0',
                  borderRadius: 14,
                  color: '#ecf5ff',
                  boxShadow: '0 18px 40px rgba(0, 10, 24, 0.34)',
                }}
                labelStyle={{ color: '#adc6e4' }}
              />
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
