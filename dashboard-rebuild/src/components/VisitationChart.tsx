import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend
} from 'recharts';

interface VisitationChartProps {
  data: Record<string, any>;
  parkName: string;
  mode: 'line' | 'overlay';
}

const COVID_START = new Date('2020-02-28');

export default function VisitationChart({ data, parkName, mode }: VisitationChartProps) {
  const { lineData, overlayData } = useMemo(() => {
    if (!data || Object.keys(data).length === 0) {
      return { lineData: [], overlayData: [] };
    }

    const rawPoints: { date: Date; value: number }[] = [];
    const preByMonth: Record<number, number[]> = {};
    const postByMonth: Record<number, number[]> = {};

    for (const [key, value] of Object.entries(data)) {
      const d = new Date(key);
      if (isNaN(d.getTime())) continue;
      const numVal = Number(value);
      if (isNaN(numVal)) continue;

      rawPoints.push({ date: d, value: numVal });

      const month = d.getMonth();
      if (d < COVID_START) {
        (preByMonth[month] = preByMonth[month] || []).push(numVal);
      } else {
        (postByMonth[month] = postByMonth[month] || []).push(numVal);
      }
    }

    // Sort by date
    rawPoints.sort((a, b) => a.date.getTime() - b.date.getTime());
    const lineData = rawPoints.map(p => ({
      date: p.date.toISOString().slice(0, 7),
      visitors: p.value
    }));

    // Overlay: average by month
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const overlayData = monthNames.map((name, i) => {
      const preArr = preByMonth[i] || [];
      const postArr = postByMonth[i] || [];
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
      <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm border border-dashed border-slate-700/50 rounded-2xl bg-slate-900/40">
        <svg className="w-8 h-8 text-slate-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span className="font-medium text-slate-300">No visitation telemetry available</span>
        <span className="text-xs text-slate-500 mt-1">Historical data not found for this location</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/40 rounded-2xl p-4 border border-white/5">
      <div className="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wider">
        {mode === 'line' ? 'Monthly Visitors Timeline' : 'Pre vs Post COVID Comparison'} — {parkName}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        {mode === 'line' ? (
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={{ stroke: '#475569' }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={{ stroke: '#475569' }} width={50} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Line type="monotone" dataKey="visitors" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        ) : (
          <LineChart data={overlayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} width={50} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }}
            />
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} />
            <Line type="monotone" dataKey="preCovid" name="Pre-COVID" stroke="#845EC2" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="postCovid" name="Post-COVID" stroke="#ff3d00" strokeWidth={2} dot={false} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
