import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { api } from '../lib/api';
import { TestRecord, TestResult } from '../types';

const COLORS = {
  left: '#00d4ff',
  right: '#00ff88',
  warning: '#ffaa00',
  danger: '#ff4466',
  text: '#64748b',
  grid: '#1f1f25',
};

const tooltipStyle = {
  backgroundColor: '#131318',
  border: '1px solid rgba(0, 212, 255, 0.25)',
  borderRadius: 8,
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
};

type CompareData = {
  test: TestRecord;
  result: TestResult;
};

export default function CompareResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const leftId = parseInt(searchParams.get('left') || '0', 10);
  const rightId = parseInt(searchParams.get('right') || '0', 10);

  const [left, setLeft] = useState<CompareData | null>(null);
  const [right, setRight] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const validIds = leftId > 0 && rightId > 0 && leftId !== rightId;

  useEffect(() => {
    if (!validIds) {
      setLoading(false);
      setError('Please choose two different completed tests to compare.');
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [leftTest, leftResult, rightTest, rightResult] = await Promise.all([
          api.getTest(leftId),
          api.getResults(leftId),
          api.getTest(rightId),
          api.getResults(rightId),
        ]);

        if (cancelled) return;

        setLeft({ test: leftTest, result: leftResult });
        setRight({ test: rightTest, result: rightResult });
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Unable to load comparison data.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [leftId, rightId, validIds]);

  const chartData = useMemo(() => {
    if (!left?.result || !right?.result) {
      return {
        responseTime: [],
        throughput: [],
        errorRate: [],
      };
    }

    const bucket = (
      points: { timestamp: string; value: number }[],
      bucketMs = 5000
    ) => {
      if (!points.length) return [];

      const sorted = [...points].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      const start = new Date(sorted[0].timestamp).getTime();

      const buckets: Record<number, number[]> = {};

      for (const point of sorted) {
        const t = new Date(point.timestamp).getTime();
        const key = Math.floor((t - start) / bucketMs);
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(point.value);
      }

      return Object.entries(buckets).map(([key, values]) => ({
        index: Number(key),
        avg: values.reduce((sum, v) => sum + v, 0) / values.length,
        count: values.length,
      }));
    };

    const leftResp = bucket(left.result.metrics.http_req_duration || []);
    const rightResp = bucket(right.result.metrics.http_req_duration || []);

    const leftReqs = bucket(left.result.metrics.http_reqs || []);
    const rightReqs = bucket(right.result.metrics.http_reqs || []);

    const leftFailed = bucket(left.result.metrics.http_req_failed || []);
    const rightFailed = bucket(right.result.metrics.http_req_failed || []);

    const maxLen = Math.max(
      leftResp.length,
      rightResp.length,
      leftReqs.length,
      rightReqs.length,
      leftFailed.length,
      rightFailed.length
    );

    const responseTime = Array.from({ length: maxLen }, (_, i) => ({
      time: `${String(Math.floor((i * 5) / 60)).padStart(2, '0')}:${String((i * 5) % 60).padStart(2, '0')}`,
      left: leftResp[i]?.avg ?? null,
      right: rightResp[i]?.avg ?? null,
    }));

    const throughput = Array.from({ length: maxLen }, (_, i) => ({
      time: `${String(Math.floor((i * 5) / 60)).padStart(2, '0')}:${String((i * 5) % 60).padStart(2, '0')}`,
      left: leftReqs[i] ? leftReqs[i].count / 5 : null,
      right: rightReqs[i] ? rightReqs[i].count / 5 : null,
    }));

    const errorRate = Array.from({ length: maxLen }, (_, i) => ({
      time: `${String(Math.floor((i * 5) / 60)).padStart(2, '0')}:${String((i * 5) % 60).padStart(2, '0')}`,
      left: leftFailed[i] ? leftFailed[i].avg * 100 : 0,
      right: rightFailed[i] ? rightFailed[i].avg * 100 : 0,
    }));

    return { responseTime, throughput, errorRate };
  }, [left, right]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-4xl text-accent animate-spin">
            progress_activity
          </span>
          <span className="font-label text-sm text-slate-500 uppercase tracking-widest">
            Loading Comparison
          </span>
        </div>
      </div>
    );
  }

  if (error || !left || !right) {
    return (
      <div className="card max-w-2xl mx-auto mt-16 text-center">
        <span className="material-symbols-outlined text-4xl text-danger-light mb-4">
          compare_arrows
        </span>
        <p className="text-danger-light mb-4">
          {error || 'Unable to load selected results.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate('/history')}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to History
          </button>
          <Link
            to="/results"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-surface-dark font-bold text-sm"
          >
            <span className="material-symbols-outlined text-sm">analytics</span>
            Results Archive
          </Link>
        </div>
      </div>
    );
  }

  const leftSummary = left.result.summary;
  const rightSummary = right.result.summary;

  return (
    <div className="animate-fade-in pb-20">
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-headline font-extrabold tracking-tight text-text-surface">
              Compare Results
            </h2>
            <span className="px-3 py-1 rounded-full bg-accent/10 text-accent text-[10px] font-bold tracking-widest border border-accent/20">
              SIDE BY SIDE
            </span>
          </div>
          <p className="text-slate-500 font-medium">
            Compare two saved test runs across latency, throughput, and error rate.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/test/${left.test.id}/results`)}
            className="px-4 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container hover:bg-surface-high transition-all text-sm font-semibold"
          >
            Open #{left.test.id}
          </button>
          <button
            onClick={() => navigate(`/test/${right.test.id}/results`)}
            className="px-4 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container hover:bg-surface-high transition-all text-sm font-semibold"
          >
            Open #{right.test.id}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <RunCard title={`Test #${left.test.id}`} color="left" test={left.test} />
        <RunCard title={`Test #${right.test.id}`} color="right" test={right.test} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <CompareMetricCard
          label="Avg Response Time"
          unit="ms"
          leftValue={leftSummary.avg_response_time}
          rightValue={rightSummary.avg_response_time}
          preferLower
        />
        <CompareMetricCard
          label="P95 Latency"
          unit="ms"
          leftValue={leftSummary.p95_response_time}
          rightValue={rightSummary.p95_response_time}
          preferLower
        />
        <CompareMetricCard
          label="Throughput"
          unit="req/s"
          leftValue={leftSummary.throughput}
          rightValue={rightSummary.throughput}
          preferHigher
        />
        <CompareMetricCard
          label="Error Rate"
          unit="%"
          leftValue={(leftSummary.error_rate || 0) * 100}
          rightValue={(rightSummary.error_rate || 0) * 100}
          preferLower
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-headline font-bold text-sm tracking-wide">
              Response Time Comparison
            </h3>
            <ChartLegend />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData.responseTime}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
              <XAxis dataKey="time" tick={{ fill: COLORS.text, fontSize: 11 }} />
              <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} unit="ms" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line
                type="monotone"
                dataKey="left"
                stroke={COLORS.left}
                strokeWidth={2.5}
                dot={false}
                name={`#${left.test.id}`}
              />
              <Line
                type="monotone"
                dataKey="right"
                stroke={COLORS.right}
                strokeWidth={2.5}
                dot={false}
                name={`#${right.test.id}`}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-headline font-bold text-sm tracking-wide">
              Throughput Comparison
            </h3>
            <ChartLegend />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData.throughput}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
              <XAxis dataKey="time" tick={{ fill: COLORS.text, fontSize: 11 }} />
              <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} unit="rps" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line
                type="monotone"
                dataKey="left"
                stroke={COLORS.left}
                strokeWidth={2.5}
                dot={false}
                name={`#${left.test.id}`}
              />
              <Line
                type="monotone"
                dataKey="right"
                stroke={COLORS.right}
                strokeWidth={2.5}
                dot={false}
                name={`#${right.test.id}`}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-headline font-bold text-sm tracking-wide">
              Error Rate Over Time
            </h3>
            <ChartLegend />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData.errorRate}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
              <XAxis dataKey="time" tick={{ fill: COLORS.text, fontSize: 11 }} />
              <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [`${value.toFixed(2)}%`, 'Error Rate']}
              />
              <Legend />
              <Bar dataKey="left" name={`#${left.test.id}`} radius={[4, 4, 0, 0]}>
                {chartData.errorRate.map((entry, i) => (
                  <Cell
                    key={`left-${i}`}
                    fill={entry.left > 5 ? COLORS.danger : COLORS.left}
                    fillOpacity={0.75}
                  />
                ))}
              </Bar>
              <Bar dataKey="right" name={`#${right.test.id}`} radius={[4, 4, 0, 0]}>
                {chartData.errorRate.map((entry, i) => (
                  <Cell
                    key={`right-${i}`}
                    fill={entry.right > 5 ? COLORS.warning : COLORS.right}
                    fillOpacity={0.75}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-headline font-bold text-sm tracking-wide">
            Detailed Summary
          </h3>
          <span className="text-[10px] font-label uppercase tracking-widest text-slate-500">
            Winner highlighted by better metric
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="text-slate-400 font-label text-[10px] uppercase tracking-widest border-b border-outline-variant/10">
                <th className="py-4 pr-4">Metric</th>
                <th className="py-4 px-4 text-right">#{left.test.id}</th>
                <th className="py-4 px-4 text-center">Delta</th>
                <th className="py-4 pl-4 text-right">#{right.test.id}</th>
              </tr>
            </thead>
            <tbody className="font-sans text-sm">
              <CompareRow
                label="Total Requests"
                leftValue={leftSummary.total_requests}
                rightValue={rightSummary.total_requests}
                preferHigher
                formatter={v => v.toLocaleString()}
              />
              <CompareRow
                label="Avg Response Time"
                leftValue={leftSummary.avg_response_time}
                rightValue={rightSummary.avg_response_time}
                preferLower
                formatter={v => `${v.toFixed(1)} ms`}
              />
              <CompareRow
                label="Min Response Time"
                leftValue={leftSummary.min_response_time}
                rightValue={rightSummary.min_response_time}
                preferLower
                formatter={v => `${v.toFixed(1)} ms`}
              />
              <CompareRow
                label="Max Response Time"
                leftValue={leftSummary.max_response_time}
                rightValue={rightSummary.max_response_time}
                preferLower
                formatter={v => `${v.toFixed(1)} ms`}
              />
              <CompareRow
                label="P50"
                leftValue={leftSummary.p50_response_time}
                rightValue={rightSummary.p50_response_time}
                preferLower
                formatter={v => `${v.toFixed(1)} ms`}
              />
              <CompareRow
                label="P90"
                leftValue={leftSummary.p90_response_time}
                rightValue={rightSummary.p90_response_time}
                preferLower
                formatter={v => `${v.toFixed(1)} ms`}
              />
              <CompareRow
                label="P95"
                leftValue={leftSummary.p95_response_time}
                rightValue={rightSummary.p95_response_time}
                preferLower
                formatter={v => `${v.toFixed(1)} ms`}
              />
              <CompareRow
                label="P99"
                leftValue={leftSummary.p99_response_time}
                rightValue={rightSummary.p99_response_time}
                preferLower
                formatter={v => `${v.toFixed(1)} ms`}
              />
              <CompareRow
                label="Throughput"
                leftValue={leftSummary.throughput}
                rightValue={rightSummary.throughput}
                preferHigher
                formatter={v => `${v.toFixed(1)} req/s`}
              />
              <CompareRow
                label="Error Rate"
                leftValue={(leftSummary.error_rate || 0) * 100}
                rightValue={(rightSummary.error_rate || 0) * 100}
                preferLower
                formatter={v => `${v.toFixed(2)} %`}
              />
              <CompareRow
                label="Error Count"
                leftValue={leftSummary.error_count}
                rightValue={rightSummary.error_count}
                preferLower
                formatter={v => v.toLocaleString()}
              />
              <CompareRow
                label="Login Success"
                leftValue={(leftSummary.login_success_rate || 0) * 100}
                rightValue={(rightSummary.login_success_rate || 0) * 100}
                preferHigher
                formatter={v => `${v.toFixed(2)} %`}
              />
              <CompareRow
                label="Avg Login Time"
                leftValue={leftSummary.avg_login_duration}
                rightValue={rightSummary.avg_login_duration}
                preferLower
                formatter={v => `${v.toFixed(1)} ms`}
              />
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RunCard({
  title,
  color,
  test,
}: {
  title: string;
  color: 'left' | 'right';
  test: TestRecord;
}) {
  const tone =
    color === 'left'
      ? 'border-accent/20 bg-accent/5'
      : 'border-success/20 bg-success/5';

  const textTone = color === 'left' ? 'text-accent-light' : 'text-success';

  return (
    <div className={`card border ${tone}`}>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h3 className={`font-headline font-bold text-lg ${textTone}`}>{title}</h3>
          <p className="text-slate-400 text-sm mt-1 break-all">{test.target_url}</p>
        </div>
        <span className="px-3 py-1 rounded-lg bg-surface-lowest text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {test.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <InfoItem label="VUs" value={String(test.vus)} />
        <InfoItem label="Duration" value={test.duration} />
        <InfoItem label="Ramp-up" value={test.ramp_up} />
        <InfoItem
          label="Created"
          value={new Date(test.created_at).toLocaleString('en', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        />
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-lowest/50 rounded-lg px-4 py-3">
      <div className="text-[10px] font-label uppercase tracking-widest text-slate-500 mb-1">
        {label}
      </div>
      <div className="font-mono text-sm text-text-surface">{value}</div>
    </div>
  );
}

function CompareMetricCard({
  label,
  unit,
  leftValue,
  rightValue,
  preferLower,
  preferHigher,
}: {
  label: string;
  unit: string;
  leftValue: number;
  rightValue: number;
  preferLower?: boolean;
  preferHigher?: boolean;
}) {
  const winner =
    preferLower
      ? leftValue < rightValue
        ? 'left'
        : rightValue < leftValue
          ? 'right'
          : 'tie'
      : preferHigher
        ? leftValue > rightValue
          ? 'left'
          : rightValue > leftValue
            ? 'right'
            : 'tie'
        : 'tie';

  const delta = Math.abs(leftValue - rightValue);

  return (
    <div className="bg-surface-container p-6 rounded-xl border border-outline-variant/10">
      <div className="font-label text-xs uppercase tracking-widest text-slate-500 mb-4">
        {label}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
        <div className={`font-mono text-2xl font-bold ${winner === 'left' ? 'text-accent' : 'text-text-surface'}`}>
          {leftValue.toFixed(1)}
          <span className="text-sm font-normal ml-1">{unit}</span>
        </div>

        <div className="text-center">
          <div className="text-[10px] font-label uppercase tracking-widest text-slate-500">
            Delta
          </div>
          <div className="font-mono text-sm text-warning">
            {delta.toFixed(1)}
          </div>
        </div>

        <div className={`font-mono text-2xl font-bold text-right ${winner === 'right' ? 'text-success' : 'text-text-surface'}`}>
          {rightValue.toFixed(1)}
          <span className="text-sm font-normal ml-1">{unit}</span>
        </div>
      </div>
    </div>
  );
}

function CompareRow({
  label,
  leftValue,
  rightValue,
  preferLower,
  preferHigher,
  formatter,
}: {
  label: string;
  leftValue: number;
  rightValue: number;
  preferLower?: boolean;
  preferHigher?: boolean;
  formatter: (value: number) => string;
}) {
  const winner =
    preferLower
      ? leftValue < rightValue
        ? 'left'
        : rightValue < leftValue
          ? 'right'
          : 'tie'
      : preferHigher
        ? leftValue > rightValue
          ? 'left'
          : rightValue > leftValue
            ? 'right'
            : 'tie'
        : 'tie';

  const delta = rightValue - leftValue;
  const deltaText =
    Math.abs(delta) < 0.0001
      ? '0'
      : `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`;

  return (
    <tr className="border-b border-outline-variant/5">
      <td className="py-4 pr-4 text-slate-300 font-medium">{label}</td>
      <td className={`py-4 px-4 text-right font-mono ${winner === 'left' ? 'text-accent font-bold' : 'text-text-surface'}`}>
        {formatter(leftValue)}
      </td>
      <td className="py-4 px-4 text-center font-mono text-slate-500">{deltaText}</td>
      <td className={`py-4 pl-4 text-right font-mono ${winner === 'right' ? 'text-success font-bold' : 'text-text-surface'}`}>
        {formatter(rightValue)}
      </td>
    </tr>
  );
}

function ChartLegend() {
  return (
    <div className="flex gap-4">
      <div className="flex items-center gap-2">
        <span className="w-3 h-1 rounded-full bg-accent" />
        <span className="text-[10px] font-label text-slate-500 uppercase">Left</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-1 rounded-full bg-success" />
        <span className="text-[10px] font-label text-slate-500 uppercase">Right</span>
      </div>
    </div>
  );
}
