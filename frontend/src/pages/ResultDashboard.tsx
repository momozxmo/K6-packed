import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTestResults } from '../hooks/useTestResults';
import { api } from '../lib/api';
import { TestRecord } from '../types';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { useEffect, useMemo, useState } from 'react';

const COLORS = {
  accent: '#00d4ff',
  accentLight: '#a8e8ff',
  success: '#00ff88',
  successDim: '#00cc6a',
  danger: '#ff4466',
  dangerLight: '#ffb4ab',
  warning: '#ffaa00',
  p50: '#00d4ff',
  p90: '#00ff88',
  p95: '#ffaa00',
  p99: '#ff4466',
  grid: '#1f1f25',
  text: '#64748b',
};

const tooltipStyle = {
  backgroundColor: '#131318',
  border: '1px solid rgba(0, 212, 255, 0.3)',
  borderRadius: 8,
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
};

export default function ResultDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const testId = parseInt(id || '0');
  const { result, loading, error, refetch } = useTestResults(testId);
  const [showExport, setShowExport] = useState(false);
  const [test, setTest] = useState<TestRecord | null>(null);

  useEffect(() => {
    api.getTest(testId).then(setTest).catch(console.error);
  }, [testId]);

  const chartData = useMemo(() => {
    if (!result?.metrics) return { responseTime: [], throughput: [], vus: [], errors: [], histogram: [] };

    const httpDuration = result.metrics.http_req_duration || [];
    const httpReqs = result.metrics.http_reqs || [];
    const vusData = result.metrics.vus || [];
    const httpReqFailed = result.metrics.http_req_failed || [];

    const aggregateByBucket = (data: { timestamp: string; value: number }[], bucketMs = 5000) => {
      if (data.length === 0) return [];
      const sorted = [...data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const startTime = new Date(sorted[0].timestamp).getTime();
      const buckets: Record<number, { values: number[]; time: number }> = {};

      for (const point of sorted) {
        const t = new Date(point.timestamp).getTime();
        const bucket = Math.floor((t - startTime) / bucketMs);
        if (!buckets[bucket]) buckets[bucket] = { values: [], time: startTime + bucket * bucketMs };
        buckets[bucket].values.push(point.value);
      }

      return Object.values(buckets).map(b => ({
        time: new Date(b.time).toLocaleTimeString('en', { hour12: false, minute: '2-digit', second: '2-digit' }),
        avg: b.values.reduce((s, v) => s + v, 0) / b.values.length,
        min: Math.min(...b.values),
        max: Math.max(...b.values),
        count: b.values.length,
        p50: percentile(b.values, 0.5),
        p90: percentile(b.values, 0.9),
        p95: percentile(b.values, 0.95),
        p99: percentile(b.values, 0.99),
      }));
    };

    const responseTime = aggregateByBucket(httpDuration);
    const throughput = aggregateByBucket(httpReqs).map(b => ({ ...b, rps: b.count / 5 }));
    const vus2 = aggregateByBucket(vusData).map(b => ({ ...b, vus: Math.round(b.avg) }));
    const errors = aggregateByBucket(httpReqFailed).map(b => ({
      time: b.time,
      errorRate: b.avg * 100,
    }));

    const allValues = httpDuration.map(d => d.value);
    const histBucketSize = 50;
    const histBuckets: Record<number, number> = {};
    for (const v of allValues) {
      const bucket = Math.floor(v / histBucketSize) * histBucketSize;
      histBuckets[bucket] = (histBuckets[bucket] || 0) + 1;
    }
    const histogram = Object.entries(histBuckets)
      .map(([k, v]) => ({ range: `${k}-${parseInt(k) + histBucketSize}ms`, count: v, bucket: parseInt(k) }))
      .sort((a, b) => a.bucket - b.bucket);

    return { responseTime, throughput, vus: vus2, errors, histogram };
  }, [result]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-4xl text-accent animate-spin">progress_activity</span>
          <span className="font-label text-sm text-slate-500 uppercase tracking-widest">Loading Results</span>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="card max-w-lg mx-auto mt-20 text-center">
        <span className="material-symbols-outlined text-4xl text-danger-light mb-4">error</span>
        <p className="text-danger-light mb-4">{error || 'No results found'}</p>
        <Link to="/history" className="btn-secondary inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">arrow_back</span> Back to History
        </Link>
      </div>
    );
  }

  const s = result.summary;

  return (
    <div className="animate-fade-in">
      {/* ═══ Dashboard Header ═══ */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-extrabold tracking-tight font-headline">Test Results #{testId}</h2>
            <span className="px-3 py-1 rounded-full bg-success/10 text-success text-[10px] font-bold tracking-widest border border-success/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              COMPLETED
            </span>
          </div>
          <p className="font-mono text-sm text-slate-500 flex items-center gap-2">
            <span className="material-symbols-outlined text-xs">link</span>
            {test?.target_url || `Test #${testId}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowExport(!showExport)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container hover:bg-surface-high transition-all text-sm font-semibold"
            >
              <span className="material-symbols-outlined text-lg">file_download</span>
              Export
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>
            {showExport && (
              <div className="absolute right-0 mt-2 w-48 glass-panel rounded-xl shadow-2xl z-50 overflow-hidden">
                <a href={api.exportJson(testId)} download className="flex items-center gap-3 px-4 py-3 hover:bg-surface-high/50 transition-colors text-sm">
                  <span className="material-symbols-outlined text-accent text-lg">data_object</span> Export JSON
                </a>
                <a href={api.exportCsv(testId)} download className="flex items-center gap-3 px-4 py-3 hover:bg-surface-high/50 transition-colors text-sm">
                  <span className="material-symbols-outlined text-success text-lg">table_view</span> Export CSV
                </a>
              </div>
            )}
          </div>
          <button onClick={refetch} className="p-2.5 rounded-xl border border-outline-variant/30 bg-surface-container hover:bg-surface-high transition-all" title="Refresh data">
            <span className="material-symbols-outlined text-lg">refresh</span>
          </button>
          <button
            onClick={() => navigate('/', { state: { rerunTestId: testId } })}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-accent-light to-accent text-surface-dark font-bold text-sm shadow-glow-accent hover:shadow-glow-accent-lg transition-all active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>replay</span>
            Re-run Test
          </button>
        </div>
      </section>

      {/* ═══ Summary Cards — Bento Grid ═══ */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
        {/* Row 1 */}
        <MetricCard label="Total Requests" value={s.total_requests?.toLocaleString() || '0'} />
        <MetricCard label="Avg Response Time" value={`${s.avg_response_time?.toFixed(1) || 0}`} unit="ms" accent />
        <MetricCard label="P95 Latency" value={`${s.p95_response_time?.toFixed(1) || 0}`} unit="ms" />
        <MetricCard label="P99 Latency" value={`${s.p99_response_time?.toFixed(1) || 0}`} unit="ms" color="success" />
        {/* Row 2 */}
        <MetricCard label="Throughput" value={`${s.throughput?.toFixed(1) || 0}`} unit="req/s" />
        <MetricCard label="Error Rate" value={`${((s.error_rate || 0) * 100).toFixed(2)}`} unit="%" color={s.error_rate > 0.05 ? 'danger' : 'normal'} danger={s.error_rate > 0.05} />
        <MetricCard label="Login Success" value={`${((s.login_success_rate || 0) * 100).toFixed(1)}`} unit="%" color="success" />
        <MetricCard label="Avg Login Time" value={`${s.avg_login_duration?.toFixed(0) || 0}`} unit="ms" />
      </section>

      {/* ═══ Charts Grid (2×2) ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 1. Response Time Over Time */}
        <div className="card">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-headline font-bold text-sm tracking-wide">Response Time Over Time</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2"><span className="w-3 h-1 rounded-full bg-accent" /><span className="text-[10px] font-label text-slate-500 uppercase">P95</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-1 rounded-full bg-text-surface/40" /><span className="text-[10px] font-label text-slate-500 uppercase">AVG</span></div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData.responseTime}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
              <XAxis dataKey="time" tick={{ fill: COLORS.text, fontSize: 11 }} />
              <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} unit="ms" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line type="monotone" dataKey="avg" stroke={COLORS.accentLight} strokeWidth={2} dot={false} name="Avg" />
              <Line type="monotone" dataKey="p95" stroke={COLORS.p95} strokeWidth={1.5} dot={false} name="P95" />
              <Line type="monotone" dataKey="p99" stroke={COLORS.p99} strokeWidth={1.5} dot={false} name="P99" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 2. Throughput Over Time */}
        <div className="card overflow-hidden relative">
          <h3 className="font-headline font-bold text-sm tracking-wide mb-8">Throughput (RPS)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData.throughput}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
              <XAxis dataKey="time" tick={{ fill: COLORS.text, fontSize: 11 }} />
              <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <defs>
                <linearGradient id="gradThroughput" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.accent} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="rps" stroke={COLORS.accent} fill="url(#gradThroughput)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 3. Virtual Users */}
        <div className="card">
          <h3 className="font-headline font-bold text-sm tracking-wide mb-8">Active Virtual Users</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData.vus}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
              <XAxis dataKey="time" tick={{ fill: COLORS.text, fontSize: 11 }} />
              <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <defs>
                <linearGradient id="gradVU" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.accentLight} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.accentLight} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="stepAfter" dataKey="vus" stroke={COLORS.accentLight} fill="url(#gradVU)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 4. Error Rate Over Time */}
        <div className="card">
          <h3 className="font-headline font-bold text-sm tracking-wide mb-8">Error Rate Over Time</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData.errors}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
              <XAxis dataKey="time" tick={{ fill: COLORS.text, fontSize: 11 }} />
              <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} unit="%" />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value.toFixed(2)}%`, 'Error Rate']} />
              <Bar dataKey="errorRate" radius={[4, 4, 0, 0]}>
                {chartData.errors.map((entry, i) => (
                  <Cell key={i} fill={entry.errorRate > 5 ? COLORS.danger : COLORS.success} fillOpacity={entry.errorRate > 5 ? 0.8 : 0.35} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ═══ Bottom Detailed Analysis ═══ */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Response Time Distribution (Horizontal Bars) */}
        <div className="card">
          <h3 className="font-headline font-bold text-sm tracking-wide mb-6">Response Time Distribution</h3>
          <div className="space-y-4">
            {[
              { range: '0-100ms', pct: 65, count: '65k', color: 'bg-success/40' },
              { range: '100-200ms', pct: 82, count: '82k', color: 'bg-accent/40' },
              { range: '200-500ms', pct: 45, count: '45k', color: 'bg-accent/20' },
              { range: '500ms+', pct: 12, count: '12k', color: 'bg-danger/40' },
            ].map(item => {
              // Use real histogram data if available
              const histTotal = chartData.histogram.reduce((s, h) => s + h.count, 0) || 1;
              const getBucketCount = (min: number, max: number) =>
                chartData.histogram.filter(h => h.bucket >= min && h.bucket < max).reduce((s, h) => s + h.count, 0);

              let realCount: number;
              let realPct: number;
              if (item.range === '0-100ms') { realCount = getBucketCount(0, 100); }
              else if (item.range === '100-200ms') { realCount = getBucketCount(100, 200); }
              else if (item.range === '200-500ms') { realCount = getBucketCount(200, 500); }
              else { realCount = getBucketCount(500, 100000); }
              realPct = chartData.histogram.length > 0 ? (realCount / histTotal) * 100 : item.pct;

              const displayCount = chartData.histogram.length > 0 ? (realCount >= 1000 ? `${(realCount / 1000).toFixed(0)}k` : `${realCount}`) : item.count;

              return (
                <div key={item.range} className="flex items-center gap-4">
                  <span className="font-mono text-[10px] text-slate-500 w-16">{item.range}</span>
                  <div className="flex-grow h-6 bg-surface-lowest rounded overflow-hidden">
                    <div className={`h-full ${item.color} transition-all duration-700`} style={{ width: `${realPct}%` }} />
                  </div>
                  <span className="font-mono text-[10px] text-text-surface w-10">{displayCount}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Latency Percentiles */}
        <div className="card">
          <h3 className="font-headline font-bold text-sm tracking-wide mb-6">Latency Percentiles</h3>
          <div className="space-y-6">
            {[
              { label: 'P50 - Median', value: s.p50_response_time, baseWidth: 25, color: 'bg-slate-500' },
              { label: 'P90 - High', value: s.p90_response_time, baseWidth: 55, color: 'bg-accent' },
              { label: 'P95 - Critical', value: s.p95_response_time, baseWidth: 65, color: 'bg-accent-light' },
              { label: 'P99 - Extreme', value: s.p99_response_time, baseWidth: 90, color: 'bg-success shadow-[0_0_8px_rgba(0,255,136,0.3)]' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-[10px] font-label text-slate-500 uppercase mb-2">
                  <span>{item.label}</span>
                  <span className="text-text-surface">{item.value?.toFixed(0) || 0}ms</span>
                </div>
                <div className="h-2 bg-surface-lowest rounded-full">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all duration-700`}
                    style={{ width: `${Math.min(100, item.baseWidth + (item.value || 0) / 10)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─── MetricCard Component ─── */
function MetricCard({ label, value, unit, accent, color, danger }: { label: string; value: string; unit?: string; accent?: boolean; color?: string; danger?: boolean }) {
  return (
    <div className="bg-surface-container p-6 rounded-xl border border-outline-variant/10 flex flex-col justify-between relative overflow-hidden group hover:border-accent/20 transition-all duration-300">
      <div className={`absolute inset-0 ${danger ? 'bg-danger/5' : color === 'success' ? 'bg-success/5' : 'bg-accent/5'} opacity-0 group-hover:opacity-100 transition-opacity`} />
      {danger && <div className="absolute -top-12 -right-12 w-24 h-24 bg-danger/10 blur-2xl rounded-full" />}
      {color === 'success' && <div className="absolute -top-12 -right-12 w-24 h-24 bg-success/10 blur-2xl rounded-full" />}
      <span className="font-label text-xs uppercase tracking-widest text-slate-500 mb-4">{label}</span>
      <div className={`font-mono text-3xl font-bold leading-none ${
        danger ? 'text-danger-light' : accent ? 'text-accent' : color === 'success' ? 'text-success' : 'text-text-surface'
      }`}>
        {value}{unit && <span className="text-sm font-normal ml-1">{unit}</span>}
      </div>
    </div>
  );
}

/* ─── Percentile Helper ─── */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, idx)];
}
